import { Paper } from '@mui/material';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Stack } from '@mui/system';
import { TooltipStack } from 'components/tooltip/TooltipStack';
import { Feature } from 'geojson';
import { OPTIMIZATION_VARIANT, RESAMPLING } from 'hooks/interfaces/useTaskApi.interface';
import { TaskAdvancedSection } from './advanced/TaskAdvancedSection';
import { TaskAreaSection } from './area/TaskAreaSection';
import { TaskBudgetSection } from './budget/TaskBudgetSection';
import { TaskLayerSection } from './layer/TaskLayerSection';
import { TaskLayerConfig, TaskLayerOption } from './layer/task-layer.interface';
import { TaskFormToolbar } from './toolbar/TaskFormToolbar';

export const COST_LAYER_PATH = 'financial/cost';

export interface TaskCreateFormValues {
  resolution: number;
  resampling: RESAMPLING;
  name: string;
  description: string | null;
  variant: OPTIMIZATION_VARIANT;
  budget: TaskLayerConfig | null;
  layers: TaskLayerConfig[];
  geometry: { id: string; name: string; description: string | null; geojson: Feature; mapboxFeatureId: string }[];
}

const COST_LAYER_OPTION: TaskLayerOption = {
  path: COST_LAYER_PATH,
  name: 'Cost',
  description: undefined,
  group: COST_LAYER_PATH.split('/').slice(0, -1).join('/'),
};

interface TaskCreateFormProps {
  isReadOnly?: boolean;
}

export const TaskCreateForm = ({ isReadOnly = false }: TaskCreateFormProps) => {
  const costLayer = COST_LAYER_OPTION;

  return (
    <>
      {!isReadOnly && (
        <Paper
          sx={{
            p: 3,
            py: 2,
            borderRadius: 0,
            borderBottom: '1px solid',
            borderColor: 'divider',
            boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
          }}>
          <TaskFormToolbar />
        </Paper>
      )}

      <Stack
        sx={{
          px: 3,
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
        }}>
        <Box>
          <TaskAreaSection isReadOnly={isReadOnly} />
        </Box>

        <Box flex={0}>
          <TooltipStack tooltip="Enter the amount of money you have to spend" mb={1}>
            <Typography
              color="textSecondary"
              fontWeight={700}
              textTransform="uppercase"
              letterSpacing={0.5}
              variant="body2">
              Budget
            </Typography>
          </TooltipStack>
          <TaskBudgetSection costLayer={costLayer} />
        </Box>

        <Box>
          <TooltipStack tooltip="Select layers to conserve or avoid" mb={1}>
            <Typography
              color="textSecondary"
              fontWeight={700}
              textTransform="uppercase"
              letterSpacing={0.5}
              variant="body2">
              Layers
            </Typography>
          </TooltipStack>
          <TaskLayerSection isReadOnly={isReadOnly} />
        </Box>

        <Box>
          <TaskAdvancedSection isReadOnly={isReadOnly} />
        </Box>
      </Stack>
    </>
  );
};
