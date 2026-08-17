import { Artifact } from '../models/artifact';

/** Returns presentation artifacts that still require publication for a run. */
export function getIncompletePublicationArtifacts(artifacts: Artifact[]): Artifact[] {
  return artifacts.filter((artifact) => {
    if (artifact.status === 'ready') {
      return false;
    }
    return artifact.type === 'pmtiles';
  });
}
