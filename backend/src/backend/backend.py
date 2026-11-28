"""FastAPI routes consumed by the Next.js workspace dashboard."""

import os
import json
from collections.abc import Generator
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, or_, select, text
from sqlalchemy.orm import Session, sessionmaker

from backend.auth import verify_token
from backend.models import (
    Asset,
    Base,
    Organization,
    OrganizationMembership,
    Project,
    ProjectMembership,
    User,
)


load_dotenv(Path(__file__).resolve().parents[2] / ".env")
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is missing. Set it in backend/.env or the process environment."
    )
if DATABASE_URL.startswith(("postgres://", "postgresql://")):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1).replace(
        "postgresql://", "postgresql+psycopg://", 1
    )
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

app = FastAPI(title="Workspace API", version="1.0.0")
allowed_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.on_event("startup")
def create_tables() -> None:
    Base.metadata.create_all(bind=engine)
    if engine.dialect.name == "postgresql":
        with engine.begin() as connection:
            for column in ("username", "email_address", "name"):
                connection.execute(
                    text(f"ALTER TABLE users ALTER COLUMN {column} DROP NOT NULL")
                )


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def cognito_profile(access_token: str, expected_sub: str) -> dict:
    domain = os.getenv("COGNITO_DOMAIN", "").strip().rstrip("/")
    if not domain:
        return {}
    if not domain.startswith(("https://", "http://")):
        domain = f"https://{domain}"
    request = Request(
        f"{domain}/oauth2/userInfo",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    try:
        with urlopen(request, timeout=5) as response:
            profile = json.loads(response.read())
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
        return {}
    return profile if isinstance(profile, dict) and profile.get("sub") == expected_sub else {}


def transfer_memberships(db: Session, source: User, target: User) -> None:
    for membership in list(source.memberships):
        if db.get(OrganizationMembership, (target.id, membership.organization_id)) is None:
            membership.user_id = target.id
    for membership in list(source.project_memberships):
        if db.get(ProjectMembership, (target.id, membership.project_id)) is None:
            membership.user_id = target.id
    db.delete(source)


def current_user(
    claims: dict = Depends(verify_token), db: Session = Depends(get_db)
) -> User:
    """Match Cognito's stable subject to a local user, creating them on first API use."""
    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject:
        raise HTTPException(status_code=401, detail="Access token has no subject")

    profile = cognito_profile(claims.get("_access_token", ""), subject)
    email = profile.get("email") if isinstance(profile.get("email"), str) else None
    username = profile.get("username") if isinstance(profile.get("username"), str) else None
    name = profile.get("name") if isinstance(profile.get("name"), str) else None

    user = db.scalar(select(User).where(User.sub_id == subject))
    email_user = db.scalar(select(User).where(User.email_address == email)) if email else None
    preserve_existing_email = False
    if user is not None and not user.active:
        raise HTTPException(status_code=403, detail="User access is disabled")
    if user is None and email_user is not None:
        if not email_user.active:
            raise HTTPException(status_code=403, detail="User access is disabled")
        user = email_user
        user.sub_id = subject
    elif user is not None and email_user is not None and email_user.id != user.id:
        if email_user.active:
            transfer_memberships(db, email_user, user)
        else:
            preserve_existing_email = True

    if user is None:
        user = User(sub_id=subject)
        db.add(user)
    if email and not preserve_existing_email:
        user.email_address = email
    if username and not preserve_existing_email:
        user.username = username
    if name and not preserve_existing_email:
        user.name = name
    try:
        db.commit()
    except Exception:
        db.rollback()
        user = db.scalar(select(User).where(User.sub_id == subject))
        if user is None:
            raise
    if not user.active:
        raise HTTPException(status_code=403, detail="User access is disabled")
    return user


def organization_membership(db: Session, user_id: int, organization_id: int):
    return db.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.user_id == user_id,
            OrganizationMembership.organization_id == organization_id,
            OrganizationMembership.active.is_(True),
            OrganizationMembership.is_active.is_(True),
            Organization.is_active.is_(True),
        )
        .join(Organization, Organization.id == OrganizationMembership.organization_id)
    )


def accessible_projects(
    db: Session, user_id: int, organization_id: int | None = None
) -> list[tuple[Project, str]]:
    """Return projects the user belongs to or can access as an organization admin."""
    memberships = db.execute(
        select(Project, ProjectMembership.role, OrganizationMembership.role)
        .join(ProjectMembership, ProjectMembership.project_id == Project.id)
        .join(Organization, Organization.id == Project.organization_id)
        .join(
            OrganizationMembership,
            OrganizationMembership.organization_id == Organization.id,
        )
        .where(
            ProjectMembership.user_id == user_id,
            ProjectMembership.active.is_(True),
            ProjectMembership.is_active.is_(True),
            OrganizationMembership.user_id == user_id,
            OrganizationMembership.active.is_(True),
            OrganizationMembership.is_active.is_(True),
            Organization.is_active.is_(True),
            Project.is_active.is_(True),
        )
    ).all()
    by_id: dict[int, tuple[Project, str]] = {
        project.id: (project, role) for project, role, _org_role in memberships
    }

    admin_query = (
        select(Project, OrganizationMembership.role)
        .join(Organization, Organization.id == Project.organization_id)
        .join(
            OrganizationMembership,
            OrganizationMembership.organization_id == Organization.id,
        )
        .where(
            OrganizationMembership.user_id == user_id,
            OrganizationMembership.active.is_(True),
            OrganizationMembership.is_active.is_(True),
            OrganizationMembership.role == "org_admin",
            Organization.is_active.is_(True),
            Project.is_active.is_(True),
            ~select(ProjectMembership.user_id)
            .where(
                ProjectMembership.user_id == user_id,
                ProjectMembership.project_id == Project.id,
                or_(
                    ProjectMembership.active.is_(False),
                    ProjectMembership.is_active.is_(False),
                ),
            )
            .exists(),
        )
    )
    if organization_id is not None:
        admin_query = admin_query.where(Project.organization_id == organization_id)
    for project, _role in db.execute(admin_query).all():
        by_id.setdefault(project.id, (project, "project_viewer"))

    if organization_id is not None:
        by_id = {
            project_id: pair
            for project_id, pair in by_id.items()
            if pair[0].organization_id == organization_id
        }
    return list(by_id.values())


def asset_json(asset: Asset) -> dict:
    return {
        "id": asset.id,
        "title": asset.title,
        "description": asset.description,
        "capture_date": asset.capture_date.isoformat() if asset.capture_date else None,
        "object_key": asset.object_key or "",
    }


def project_json(project: Project, role: str, include_assets: bool = True) -> dict:
    data = {
        "id": project.id,
        "title": project.title,
        "description": project.description,
        "role": role,
        "is_active": project.is_active,
    }
    if include_assets:
        assets = project._api_assets if hasattr(project, "_api_assets") else project.assets
        data["assets"] = [asset_json(asset) for asset in assets]
    return data


def organization_json(
    organization: Organization,
    role: str,
    projects: list[tuple[Project, str]],
    include_assets: bool = True,
) -> dict:
    return {
        "id": organization.id,
        "name": organization.name,
        "role": role,
        "is_active": organization.is_active,
        "projects": [
            project_json(project, project_role, include_assets)
            for project, project_role in projects
        ],
    }


def dashboard_data(db: Session, user: User) -> dict:
    memberships = db.execute(
        select(OrganizationMembership, Organization)
        .join(Organization, Organization.id == OrganizationMembership.organization_id)
        .where(
            OrganizationMembership.user_id == user.id,
            OrganizationMembership.active.is_(True),
            OrganizationMembership.is_active.is_(True),
            Organization.is_active.is_(True),
        )
        .order_by(Organization.name)
    ).all()
    organizations = []
    for membership, organization in memberships:
        projects = accessible_projects(db, user.id, organization.id)
        project_ids = [project.id for project, _role in projects]
        assets = db.scalars(
            select(Asset).where(Asset.project_id.in_(project_ids)).order_by(Asset.id)
        ).all() if project_ids else []
        assets_by_project: dict[int, list[Asset]] = {}
        for asset in assets:
            assets_by_project.setdefault(asset.project_id, []).append(asset)
        for project, _role in projects:
            project._api_assets = assets_by_project.get(project.id, [])
        organizations.append(
            organization_json(organization, membership.role, projects)
        )
    return {
        "user": {
            "id": user.id,
            "sub_id": user.sub_id,
        },
        "organizations": organizations,
    }


@app.get("/")
def index() -> dict:
    return {"status": "ok"}


@app.get("/profile")
def get_profile(user: User = Depends(current_user)) -> dict:
    return {
        "id": user.id,
        "sub_id": user.sub_id,
    }


@app.get("/dashboard")
def get_dashboard(
    user: User = Depends(current_user), db: Session = Depends(get_db)
) -> dict:
    return dashboard_data(db, user)


@app.get("/organizations")
def get_organizations(
    user: User = Depends(current_user), db: Session = Depends(get_db)
) -> list[dict]:
    data = dashboard_data(db, user)
    return data["organizations"]


@app.get("/organizations/{organization_id}")
def get_organization(
    organization_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    membership = organization_membership(db, user.id, organization_id)
    if membership is None:
        raise HTTPException(status_code=404, detail="Organization not found")
    organization = db.scalar(select(Organization).where(Organization.id == organization_id))
    projects = accessible_projects(db, user.id, organization_id)
    project_ids = [project.id for project, _role in projects]
    assets = db.scalars(select(Asset).where(Asset.project_id.in_(project_ids))).all() if project_ids else []
    assets_by_project: dict[int, list[Asset]] = {}
    for asset in assets:
        assets_by_project.setdefault(asset.project_id, []).append(asset)
    for project, _role in projects:
        project._api_assets = assets_by_project.get(project.id, [])
    return organization_json(organization, membership.role, projects)


@app.get("/projects")
def get_projects(
    user: User = Depends(current_user), db: Session = Depends(get_db)
) -> list[dict]:
    projects = accessible_projects(db, user.id)
    project_ids = [project.id for project, _role in projects]
    assets = db.scalars(select(Asset).where(Asset.project_id.in_(project_ids))).all() if project_ids else []
    assets_by_project: dict[int, list[Asset]] = {}
    for asset in assets:
        assets_by_project.setdefault(asset.project_id, []).append(asset)
    for project, _role in projects:
        project._api_assets = assets_by_project.get(project.id, [])
    return [project_json(project, role) for project, role in projects]


@app.get("/projects/{project_id}")
def get_project(
    project_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    project_access = next(
        ((project, role) for project, role in accessible_projects(db, user.id) if project.id == project_id),
        None,
    )
    if project_access is None:
        raise HTTPException(status_code=404, detail="Project not found")
    project, role = project_access
    project._api_assets = db.scalars(select(Asset).where(Asset.project_id == project.id)).all()
    return project_json(project, role)


@app.get("/projects/{project_id}/assets")
def get_project_assets(
    project_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    if not any(project.id == project_id for project, _role in accessible_projects(db, user.id)):
        raise HTTPException(status_code=404, detail="Project not found")
    assets = db.scalars(
        select(Asset).where(Asset.project_id == project_id).order_by(Asset.id)
    ).all()
    return [asset_json(asset) for asset in assets]


@app.get("/assets")
def get_assets(
    user: User = Depends(current_user), db: Session = Depends(get_db)
) -> list[dict]:
    project_ids = [project.id for project, _role in accessible_projects(db, user.id)]
    if not project_ids:
        return []
    assets = db.scalars(
        select(Asset).where(Asset.project_id.in_(project_ids)).order_by(Asset.id)
    ).all()
    return [asset_json(asset) for asset in assets]
