import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { TASK_TYPE } from 'hooks/interfaces/useTaskApi.interface';
import { PMTiles } from 'pmtiles';
import { useEffect, useMemo, useState } from 'react';

type PmtilesSurface = 'decision' | 'allocation' | 'priority';

interface PmtilesLegendProps {
  pmtilesUrls: string[];
  taskType?: TASK_TYPE | null;
}

interface PmtilesLegendEntry {
  surface: PmtilesSurface;
  colorRamp: string | null;
}

interface LegendDefinition {
  key: string;
  title: string;
  rows: LegendRow[];
}

interface LegendRow {
  label?: string;
  color?: string;
  gradient?: string;
  startLabel?: string;
  endLabel?: string;
}

/**
 * Displays the legend that corresponds to currently rendered PMTiles outputs.
 *
 * @param {PmtilesLegendProps} props
 * @returns {JSX.Element | null}
 */
export const PmtilesLegend = ({ pmtilesUrls, taskType }: PmtilesLegendProps) => {
  const [entries, setEntries] = useState<PmtilesLegendEntry[]>([]);

  useEffect(() => {
    let isCancelled = false;
    const fallbackLegendEntry = getFallbackLegendEntry(taskType);

    const loadMetadata = async () => {
      const nextEntries: PmtilesLegendEntry[] = [];

      for (const url of pmtilesUrls) {
        try {
          const pmtiles = new PMTiles(getPmtilesMetadataUrl(url));
          const metadata = (await pmtiles.getMetadata()) as Record<string, unknown>;
          nextEntries.push(getLegendEntryFromMetadata(metadata, taskType));
        } catch {
          nextEntries.push(fallbackLegendEntry);
        }
      }

      if (isCancelled) {
        return;
      }

      setEntries(nextEntries);
    };

    if (pmtilesUrls.length === 0) {
      setEntries([]);
      return undefined;
    }

    void loadMetadata();

    return () => {
      isCancelled = true;
    };
  }, [pmtilesUrls, taskType]);

  const definitions = useMemo(() => {
    const uniqueDefinitions = new Map<string, LegendDefinition>();

    entries.forEach((entry) => {
      const definition = getLegendDefinition(entry);
      uniqueDefinitions.set(definition.key, definition);
    });

    return Array.from(uniqueDefinitions.values());
  }, [entries]);

  if (definitions.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        position: 'absolute',
        right: 16,
        bottom: 32,
        zIndex: 10,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        boxShadow: 3,
        p: 1.5,
        minWidth: 220,
        maxWidth: 280,
      }}>
      <Stack spacing={1.5}>
        {definitions.map((definition) => (
          <Box key={definition.key}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
              {definition.title}
            </Typography>
            <Stack spacing={0.75}>
              {definition.rows.map((row, index) => (
                <Box key={row.label ?? index}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Box
                      sx={{
                        width: row.label ? 32 : '100%',
                        height: 12,
                        borderRadius: 0.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: row.color,
                        background: row.gradient,
                        flex: '0 0 auto',
                      }}
                    />
                    {row.label ? <Typography variant="body2">{row.label}</Typography> : null}
                  </Box>
                  {row.startLabel && row.endLabel ? (
                    <Box display="flex" justifyContent="space-between" sx={{ pl: row.label ? 5 : 0, mt: 0.25 }}>
                      <Typography variant="caption" color="text.secondary">
                        {row.startLabel}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {row.endLabel}
                      </Typography>
                    </Box>
                  ) : null}
                </Box>
              ))}
            </Stack>
          </Box>
        ))}
      </Stack>
    </Box>
  );
};

const getFallbackLegendEntry = (taskType?: TASK_TYPE | null): PmtilesLegendEntry => {
  if (taskType === 'continuous_optimization') {
    return {
      surface: 'allocation',
      colorRamp: null,
    };
  }

  if (taskType === 'priority_ranking') {
    return {
      surface: 'priority',
      colorRamp: null,
    };
  }

  return {
    surface: 'decision',
    colorRamp: null,
  };
};

const getLegendEntryFromMetadata = (
  metadata: Record<string, unknown>,
  taskType?: TASK_TYPE | null
): PmtilesLegendEntry => {
  const surface = metadata.surface;
  const colorRamp = metadata.color_ramp;

  if (surface !== 'allocation' && surface !== 'priority' && surface !== 'decision') {
    return getFallbackLegendEntry(taskType);
  }

  return {
    surface,
    colorRamp: typeof colorRamp === 'string' ? colorRamp : null,
  };
};

const getPmtilesMetadataUrl = (url: string): string => {
  if (url.startsWith('pmtiles://')) {
    return url.slice('pmtiles://'.length);
  }

  return url;
};

const getLegendDefinition = (entry: PmtilesLegendEntry): LegendDefinition => {
  if (entry.surface === 'allocation') {
    return {
      key: `allocation:${entry.colorRamp ?? 'default'}`,
      title: 'Continuous allocation',
      rows: [
        {
          gradient: 'linear-gradient(90deg, #440154 0%, #31688e 35%, #35b779 70%, #fde725 100%)',
          startLabel: 'Low',
          endLabel: 'High',
        },
      ],
    };
  }

  if (entry.surface === 'priority') {
    return {
      key: `priority:${entry.colorRamp ?? 'default'}`,
      title: 'Priority',
      rows: [
        {
          gradient: 'linear-gradient(90deg, #000004 0%, #721f81 35%, #f1605d 70%, #fcfdbf 100%)',
          startLabel: 'Low',
          endLabel: 'High',
        },
      ],
    };
  }

  return {
    key: `decision:${entry.colorRamp ?? 'default'}`,
    title: 'Discrete selection',
    rows: [
      {
        label: 'Selected',
        color: 'rgba(154, 217, 60, 0.86)',
      },
      {
        label: 'Considered',
        color: 'rgba(160, 160, 160, 0.7)',
      },
    ],
  };
};
