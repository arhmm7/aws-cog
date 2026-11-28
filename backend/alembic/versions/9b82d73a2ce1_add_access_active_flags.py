"""Add boolean account and membership access flags.

Revision ID: 9b82d73a2ce1
Revises: 688f5d299c57
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9b82d73a2ce1"
down_revision: Union[str, Sequence[str], None] = "688f5d299c57"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _ensure_boolean_column(table: str, column_name: str) -> None:
    columns = {column["name"]: column for column in sa.inspect(op.get_bind()).get_columns(table)}
    if column_name not in columns:
        op.add_column(
            table,
            sa.Column(column_name, sa.Boolean(), nullable=False, server_default=sa.true()),
        )
        return

    column = columns[column_name]
    if isinstance(column["type"], sa.Boolean):
        return

    # Normalize old String columns before converting them, including values such
    # as "True" and "False" created by the earlier model declaration.
    value = f"lower(trim(CAST({column_name} AS VARCHAR)))"
    true_value, false_value = (
        ("1", "0") if op.get_bind().dialect.name == "sqlite" else ("true", "false")
    )
    op.execute(
        sa.text(
            f"UPDATE {table} SET {column_name} = CASE "
            f"WHEN {value} IN ('true', '1', 'yes', 'on') THEN '{true_value}' "
            f"WHEN {value} IN ('false', '0', 'no', 'off') THEN '{false_value}' "
            f"ELSE '{false_value}' END"
        )
    )

    alter = {
        "existing_type": column["type"],
        "type_": sa.Boolean(),
        "nullable": False,
        "server_default": sa.true(),
    }
    if op.get_bind().dialect.name == "postgresql":
        op.alter_column(
            table,
            column_name,
            postgresql_using=f'"{column_name}"::boolean',
            **alter,
        )
    else:
        with op.batch_alter_table(table) as batch_op:
            batch_op.alter_column(column_name, **alter)


def upgrade() -> None:
    _ensure_boolean_column("users", "active")
    _ensure_boolean_column("organization_memberships", "active")
    _ensure_boolean_column("project_memberships", "active")

    # Treat either false flag as revoked while the legacy field remains in the DB.
    for table in ("organization_memberships", "project_memberships"):
        columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns(table)}
        if "is_active" in columns:
            op.execute(sa.text(f"UPDATE {table} SET active = active AND is_active"))


def downgrade() -> None:
    op.drop_column("project_memberships", "active")
    op.drop_column("organization_memberships", "active")
    op.drop_column("users", "active")
