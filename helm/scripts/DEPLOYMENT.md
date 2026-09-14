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
4. Wait up to fifteen minutes for the database rollout before running Helm. Prefect's
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

## PVC handoff and worker startup

The database and worker Deployments use `Recreate`, with two minutes for graceful
shutdown and a twenty-minute progress deadline. Helm waits up to twenty minutes
per operation. This allows time for a ReadWriteOnce volume to detach from its old
node and attach to the replacement. Persistent attachment failures still require
platform storage investigation; the pipeline never force-detaches or deletes PVCs.
For immutable Git SHA image tags, the database no longer restarts solely because
the Helm release revision changes; image or pod configuration changes still roll
it out. Mutable tags such as dev/test/prod retain the revision annotation so a
promotion still pulls the new database image.

The worker container waits up to ten minutes for a read-only work-pool query to
succeed, proving both the Prefect API and database schema are ready, and ensures
its work pool exists before starting. It does not register deployments or recovery
automations. Those operations run once in the Prefect registration hook after
migrations. The readiness wait runs inside the main container, allowing Helm to
reach post-install hooks on a fresh installation. Pod readiness during this wait
means the container is running, not that the worker is already polling Prefect.
The registration hook additionally requires a new online-worker heartbeat from
every configured pool within three minutes. A stopped worker's older heartbeat
cannot satisfy this check. Hook success is required for the Helm operation to succeed.

Successful application setup Jobs are deleted by Helm. Failed setup and registration
Jobs retain logs and expire after one day; registration has a fifteen-minute deadline
and two retries. Existing historical setup Jobs are unaffected by the new policy.
CI failure diagnostics include pod node placement, PVCs, warning events, and current
and previous logs for waiting, failed, or restarted application containers, including
init containers. These diagnostics are collected without cluster-admin access.
