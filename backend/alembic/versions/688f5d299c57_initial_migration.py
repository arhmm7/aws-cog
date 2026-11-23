"""initial migration

Revision ID: 688f5d299c57
Revises: 
Create Date: 2026-11-23 14:30:32.021250

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '688f5d299c57'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('users', 'sub_id',
               existing_type=sa.VARCHAR(),
               nullable=False)


def downgrade() -> None:
    op.alter_column('users', 'sub_id',
               existing_type=sa.VARCHAR(),
               nullable=True)
