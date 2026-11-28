"""Route-level tests for project access between different users."""

import os

# backend.backend reads these settings during import. Keep its startup engine
# local to this test process; route tests below use their own temporary database.
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["COGNITO_ISSUER"] = "https://cognito.example.test/test-pool"
os.environ["COGNITO_CLIENT_ID"] = "test-client"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import Session

from backend.backend import app, current_user, get_db
from backend.models import (
    Base,
    Organization,
    OrganizationMembership,
    Project,
    ProjectMembership,
    User,
)


@pytest.fixture
def project_access_case(tmp_path):
    test_db_path = tmp_path / "project-access-test.db"
    database_url = URL.create(
        "sqlite", database=str(test_db_path)
    )
    test_engine = create_engine(database_url)
    Base.metadata.create_all(test_engine)

    db = Session(test_engine, expire_on_commit=False)
    user_a = User(sub_id="user-a", email_address="a@example.test")
    user_b = User(sub_id="user-b", email_address="b@example.test")
    organization = Organization(name="Test organization")
    project = Project(
        title="User A project",
        description="Private project for access tests",
        organization=organization,
    )
    db.add_all([user_a, user_b, organization, project])
    db.flush()

    # Both users belong to the organization, but only User A belongs to the
    # project. User B is an ordinary org member, so they do not inherit access.
    db.add_all(
        [
            OrganizationMembership(
                user_id=user_a.id,
                organization_id=organization.id,
                role="org_member",
            ),
            OrganizationMembership(
                user_id=user_b.id,
                organization_id=organization.id,
                role="org_member",
            ),
            ProjectMembership(
                user_id=user_a.id,
                project_id=project.id,
                role="project_viewer",
            ),
        ]
    )
    db.commit()

    selected_user = {"value": user_a}

    def override_current_user():
        return selected_user["value"]

    def override_get_db():
        yield db

    previous_overrides = app.dependency_overrides.copy()
    app.dependency_overrides[current_user] = override_current_user
    app.dependency_overrides[get_db] = override_get_db

    try:
        with TestClient(app) as client:
            yield {
                "client": client,
                "db": db,
                "selected_user": selected_user,
                "user_a": user_a,
                "user_b": user_b,
                "organization": organization,
                "project": project,
            }
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous_overrides)
        db.close()
        test_engine.dispose()
        test_db_path.unlink(missing_ok=True)


def test_project_is_visible_to_member_but_not_another_org_user(project_access_case):
    case = project_access_case
    client = case["client"]
    project_id = case["project"].id

    case["selected_user"]["value"] = case["user_a"]
    response = client.get(f"/projects/{project_id}")
    assert response.status_code == 200
    assert response.json()["id"] == project_id

    case["selected_user"]["value"] = case["user_b"]
    response = client.get(f"/projects/{project_id}")
    assert response.status_code == 404

    # The project should also be absent from User B's project list.
    response = client.get("/projects")
    assert response.status_code == 200
    assert all(item["id"] != project_id for item in response.json())


def test_org_admin_inherits_project_access_without_project_membership(
    project_access_case,
):
    case = project_access_case
    db = case["db"]
    project = case["project"]
    user_b = case["user_b"]

    organization_membership = db.get(
        OrganizationMembership, (user_b.id, case["organization"].id)
    )
    organization_membership.role = "org_admin"
    db.commit()

    case["selected_user"]["value"] = user_b
    response = case["client"].get(f"/projects/{project.id}")
    assert response.status_code == 200


@pytest.mark.parametrize("inactive_flag", ["active", "is_active"])
def test_inactive_project_membership_blocks_org_admin_inherited_access(
    project_access_case, inactive_flag
):
    case = project_access_case
    db = case["db"]
    user_b = case["user_b"]
    project = case["project"]

    organization_membership = db.get(
        OrganizationMembership, (user_b.id, case["organization"].id)
    )
    organization_membership.role = "org_admin"

    membership_flags = {"active": True, "is_active": True}
    membership_flags[inactive_flag] = False
    db.add(
        ProjectMembership(
            user_id=user_b.id,
            project_id=project.id,
            role="project_viewer",
            **membership_flags,
        )
    )
    db.commit()

    case["selected_user"]["value"] = user_b
    response = case["client"].get(f"/projects/{project.id}")
    assert response.status_code == 404
