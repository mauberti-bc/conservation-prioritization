# Deployment and recovery

The dev workflow builds all six application images at the triggering commit and
deploys that commit's image tag. Every push builds a complete release, including
Helm-only changes; the former path filters and `FORCE_BUILD` variable are no longer
used. This takes longer than a partial build, but does not depend on old images
remaining in the registry. Build runs are serialized and an active deployment is
not automatically cancelled by a newer push.

The `dev` image tags are updated only after Helm finishes successfully. Test and
production promotions continue to use the existing `dev` → `test` → `prod` flow.

## Before Helm runs

`prepare-deployment.sh` uses the target namespace's service-account credentials to:

1. Check API readiness and inspect the Helm release status.
2. Verify all six requested images can be read from the registry, before changing
   any workload image. The registry credentials are stored in a temporary file and
   removed when the script exits.
3. Check PostgreSQL. If it has no ready replicas and its current image is failing
   with `ErrImagePull` or `ImagePullBackOff`, set only its image to the verified
   release image. The deployment's storage, environment, and resource settings are
   retained. A healthy database is left for the normal Helm upgrade to update.
4. Wait up to five minutes for the database rollout before running Helm. Prefect's
   pre-upgrade migration needs the existing database, so Helm cannot repair a
   missing database image on its own.

On a first installation, Helm creates the database and the chart uses post-install
migrations. If an existing release's database Deployment was deleted, preflight
fails and requires it to be restored. Database crashes, incompatible database
versions, and storage failures do not trigger automatic image replacement.

Read-only API and image checks retry three times for transient failures. Helm's
upgrade itself is not blindly retried: after a connection loss it may have applied
some resources or left a pending revision. A failure step prints release history,
pod/job status, and warning events for diagnosis.

## Recovering a failed run

- **Missing target image:** rerun the full build workflow. Rerunning only the
  deployment cannot recreate deleted images.
- **Database image-pull failure:** the deployment preflight can repair it once a
  complete target release exists. Review database image compatibility before
  deploying a PostgreSQL major-version change.
- **Pending Helm revision:** check that its owning pipeline or local Helm process
  has stopped. Inspect `helm history conservation-tool -n <namespace>` and the
  affected resources before a controlled recovery. The pipeline never deletes
  pending release records automatically.
- **Quota/storage/database failure:** resolve the reported condition and rerun the
  deployment. More retries cannot make an unavailable resource available.

API/registry outages and manual resource deletion can still fail a deployment.
These checks make the failure explicit and prevent the known missing-image
migration deadlock; they do not guarantee success during an infrastructure outage.

## Image retention

Keep the application ImageStreams in `fa9440-tools`. Retain image tags used by dev,
test, production, and the Helm revisions needed for rollback. Remove only unused
ImageStreamTags and use the platform's image-pruning process for storage cleanup.
Deleting an ImageStream removes the tag mappings that both running deployments
and rollbacks may need when containers restart. Helm history does not contain
copies of container images.

## Local verification

```bash
python3 -m unittest discover -s helm/scripts/tests
bash -n helm/scripts/prepare-deployment.sh helm/scripts/utils/retry.sh
```

The tests run the preflight script against fake cluster and registry clients.
They require Python 3, Bash, and `jq`, and do not access a live cluster.
