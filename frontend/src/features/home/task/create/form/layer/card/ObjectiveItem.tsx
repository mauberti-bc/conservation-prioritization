import { mdiDeleteOutline } from '@mdi/js';
import { Box, Slider, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { appTheme } from 'theme/AppTheme';
import { TaskObjectiveConfig } from '../optimization-form.interface';
import { LayerCard } from './LayerCard';

interface Props {
  objective: TaskObjectiveConfig;
  onChange: (objective: TaskObjectiveConfig) => void;
  onDelete: (objective: TaskObjectiveConfig) => void;
  isReadOnly?: boolean;
}

const getSignedImportance = (objective: TaskObjectiveConfig) => {
  return objective.direction === 'minimize' ? -objective.importance : objective.importance;
};

const getTrackColor = (value: number) => {
  if (value === 0) {
    return appTheme.palette.primary.main;
  }

  return value < 0 ? appTheme.palette.error.light : appTheme.palette.success.light;
};

/** Edit one objective as a simple signed influence slider. */
export const ObjectiveItem = ({ objective, onChange, onDelete, isReadOnly = false }: Props) => {
  const [localImportance, setLocalImportance] = useState(getSignedImportance(objective));
  const menuItems = [
    {
      label: 'Delete',
      icon: mdiDeleteOutline,
      onClick: () => {
        onDelete(objective);
      },
    },
  ];

  useEffect(() => {
    setLocalImportance(getSignedImportance(objective));
  }, [objective]);

  const handleImportanceChange = (value: number) => {
    onChange({
      ...objective,
      direction: value < 0 ? 'minimize' : 'maximize',
      importance: Math.abs(value),
    });
  };

  return (
    <LayerCard title={objective.name} menuOptions={isReadOnly ? [] : menuItems}>
      <Box>
        <Box display="flex" justifyContent="space-between" mb={0.5}>
          <Typography variant="caption" fontSize="0.7rem" color="text.secondary">
            Minimize
          </Typography>
          <Typography variant="caption" fontSize="0.7rem" color="text.secondary">
            Maximize
          </Typography>
        </Box>
        <Slider
          value={localImportance}
          disabled={isReadOnly}
          onChange={(_, value) => {
            setLocalImportance(value as number);
          }}
          onChangeCommitted={(_, value) => {
            handleImportanceChange(value as number);
          }}
          step={1}
          min={-100}
          max={100}
          marks={[{ value: 0 }]}
          valueLabelDisplay="auto"
          valueLabelFormat={(value) => `${value}%`}
          sx={{
            py: 1,
            height: 7,
            color: getTrackColor(localImportance),
            '& .MuiSlider-thumb': {
              border: '2px solid white',
            },
          }}
        />
      </Box>
    </LayerCard>
  );
};
