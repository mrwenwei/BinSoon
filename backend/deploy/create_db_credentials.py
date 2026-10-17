"""Create initial DB credentials without exposing passwords in argv or output.

Requires an existing Cloud SQL instance and an empty Secret Manager secret.
Does not rotate existing credentials. Uses the active gcloud identity.
"""
import json
import os
import secrets
import subprocess
import urllib.error
import urllib.parse
import urllib.request


def main():
    project = os.environ["GCP_PROJECT_ID"]
    instance = os.environ.get("CLOUD_SQL_INSTANCE", "binsoon-db")
    user = os.environ["POSTGRES_USER"]
    secret = os.environ["DB_PASSWORD_SECRET"]
    gcloud = os.environ.get("GCLOUD", "gcloud")

    def capture(*args):
        return subprocess.check_output([gcloud, *args, f"--project={project}"], text=True)

    users = json.loads(capture("sql", "users", "list", f"--instance={instance}", "--format=json"))
    versions = json.loads(capture("secrets", "versions", "list", secret, "--format=json"))
    user_exists = any(item["name"] == user for item in users)
    enabled_secret = any(item["state"] == "ENABLED" for item in versions)
    if user_exists and enabled_secret:
        print("Existing DB user and secret version found; unchanged. Verify they match before deployment.")
        return
    if user_exists or versions:
        raise SystemExit("Partial credential setup exists; reconcile it before rerunning. No credentials changed.")

    password = secrets.token_urlsafe(36)
    access_token = capture("auth", "print-access-token").strip()
    url = ("https://sqladmin.googleapis.com/sql/v1beta4/projects/"
           f"{urllib.parse.quote(project, safe='')}/instances/{urllib.parse.quote(instance, safe='')}/users")
    request = urllib.request.Request(
        url, data=json.dumps({"name": user, "password": password}).encode(),
        headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            operation = json.load(response)
    except urllib.error.HTTPError as error:
        raise SystemExit(f"Cloud SQL user creation failed: HTTP {error.code}; no secret value printed.") from None
    # Store the password immediately, even if the asynchronous operation later fails.
    # Both resources can then be reconciled without losing the generated credential.
    subprocess.run([gcloud, "secrets", "versions", "add", secret, "--data-file=-", f"--project={project}"],
                   input=password, text=True, check=True)
    subprocess.run([gcloud, "sql", "operations", "wait", operation["name"],
                    f"--project={project}", "--timeout=300"], check=True)
    print("DB user created and password stored in Secret Manager; no password printed.")


if __name__ == "__main__":
    main()
