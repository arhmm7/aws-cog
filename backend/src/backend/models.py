import enum

from datetime import date
from sqlalchemy import Date, ForeignKey, String, Boolean, true
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Role(str, enum.Enum):
    org_admin = "org_admin"
    org_member = "org_member"
    project_editor = "project_editor"
    project_viewer = "project_viewer"


class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    sub_id: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    username: Mapped[str | None] = mapped_column(String, nullable=True, unique=True)
    email_address: Mapped[str | None] = mapped_column(String, nullable=True, unique=True)
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true()
    )
    memberships: Mapped[list["OrganizationMembership"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    project_memberships: Mapped[list["ProjectMembership"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=true())
    projects: Mapped[list["Project"]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )
    memberships: Mapped[list["OrganizationMembership"]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )

class OrganizationMembership(Base):
    __tablename__ = "organization_memberships"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id"), primary_key=True
    )
    role: Mapped[str] = mapped_column(String(32), nullable=False, default=Role.org_admin.value)
    # Kept for compatibility; access checks require both membership flags active.
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=true())
    user: Mapped[User] = relationship(back_populates="memberships")
    active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true()
    )
    organization: Mapped[Organization] = relationship(back_populates="memberships")

class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=true())
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    organization: Mapped[Organization] = relationship(back_populates="projects")
    memberships: Mapped[list["ProjectMembership"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    assets: Mapped[list["Asset"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )

class ProjectMembership(Base):
    __tablename__ = "project_memberships"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), primary_key=True)
    role: Mapped[str] = mapped_column(String(32), nullable=False, default=Role.project_viewer.value)
    # Kept for compatibility; access checks require both membership flags active.
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=true())
    user: Mapped[User] = relationship(back_populates="project_memberships")
    active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true()
    )
    project: Mapped[Project] = relationship(back_populates="memberships")

class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    capture_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    object_key: Mapped[str] = mapped_column(String, nullable=False, default="")
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    project: Mapped[Project] = relationship(back_populates="assets")
