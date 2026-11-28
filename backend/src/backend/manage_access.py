"""Enable or revoke access for a user or one of their memberships.

Examples:
    uv run python -m backend.manage_access user --user alice@example.com --inactive
    uv run python -m backend.manage_access organization --user 12 --organization-id 4 --inactive
    uv run python -m backend.manage_access project --user 12 --project-id 9 --inactive
"""

import argparse
import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, or_
from sqlalchemy.orm import Session

from backend.models import OrganizationMembership, Project, ProjectMembership, User


def database_url() -> str:
    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
    url = os.getenv("DATABASE_URL", "").strip()
    if not url:
        raise RuntimeError("DATABASE_URL is missing. Set it in backend/.env or the process environment.")
    if url.startswith(("postgres://", "postgresql://")):
        url = url.replace("postgres://", "postgresql+psycopg://", 1).replace(
            "postgresql://", "postgresql+psycopg://", 1
        )
    return url


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="scope", required=True)

    user_parser = commands.add_parser("user", help="revoke or restore all access for a user")
    user_parser.add_argument("--user", required=True, help="user ID, Cognito subject, email, or username")
    add_status_flags(user_parser)

    organization_parser = commands.add_parser(
        "organization", help="revoke or restore a user's organization membership"
    )
    organization_parser.add_argument("--user", required=True, help="user ID, Cognito subject, email, or username")
    organization_parser.add_argument("--organization-id", required=True, type=int)
    add_status_flags(organization_parser)

    project_parser = commands.add_parser(
        "project", help="revoke or restore a user's project membership"
    )
    project_parser.add_argument("--user", required=True, help="user ID, Cognito subject, email, or username")
    project_parser.add_argument("--project-id", required=True, type=int)
    add_status_flags(project_parser)

    return parser.parse_args()


def add_status_flags(parser: argparse.ArgumentParser) -> None:
    status = parser.add_mutually_exclusive_group(required=True)
    status.add_argument("--active", dest="active", action="store_true", help="restore access")
    status.add_argument("--inactive", dest="active", action="store_false", help="revoke access")


def find_user(db: Session, identifier: str) -> User:
    query = db.query(User)
    if identifier.isdecimal():
        user = query.filter(User.id == int(identifier)).one_or_none()
        if user is not None:
            return user
    user = query.filter(
        or_(
            User.sub_id == identifier,
            User.email_address == identifier,
            User.username == identifier,
        )
    ).one_or_none()
    if user is None:
        raise ValueError(f"No user matched {identifier!r}")
    return user


def update_access(db: Session, args: argparse.Namespace) -> str:
    user = find_user(db, args.user)
    state = "active" if args.active else "inactive"
    if args.scope == "user":
        user.active = args.active
        return f"User {user.id} ({user.sub_id}) is now {state}."

    if args.scope == "organization":
        membership = db.get(
            OrganizationMembership, (user.id, args.organization_id)
        )
        if membership is None:
            raise ValueError(
                f"User {user.id} has no membership in organization {args.organization_id}"
            )
        membership.active = args.active
        membership.is_active = args.active
        return (
            f"User {user.id}'s membership in organization "
            f"{args.organization_id} is now {state}."
        )

    membership = db.get(ProjectMembership, (user.id, args.project_id))
    if membership is None:
        if args.active:
            raise ValueError(
                f"User {user.id} has no membership in project {args.project_id}"
            )
        if db.get(Project, args.project_id) is None:
            raise ValueError(f"Project {args.project_id} does not exist")
        # An inactive row also denies inherited organization-admin access.
        membership = ProjectMembership(
            user_id=user.id,
            project_id=args.project_id,
            role="project_viewer",
            active=False,
            is_active=False,
        )
        db.add(membership)
        return (
            f"User {user.id}'s access to project {args.project_id} is now inactive."
        )
    membership.active = args.active
    membership.is_active = args.active
    return f"User {user.id}'s membership in project {args.project_id} is now {state}."


def main() -> None:
    args = parse_args()
    engine = create_engine(database_url(), pool_pre_ping=True)
    try:
        with Session(engine) as db:
            message = update_access(db, args)
            db.commit()
    except ValueError as error:
        raise SystemExit(str(error)) from error
    print(message)


if __name__ == "__main__":
    main()
