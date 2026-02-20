import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { TooltipStack } from 'components/tooltip/TooltipStack';
import { useFormikContext } from 'formik';
import { Feature } from 'geojson';
import { OPTIMIZATION_VARIANT, RESAMPLING } from 'hooks/interfaces/useTaskApi.interface';
import { TaskAdvancedSection } from './advanced/TaskAdvancedSection';
import { TaskAreaSection } from './area/TaskAreaSection';
import { TaskBudgetSection } from './budget/TaskBudgetSection';
import { TaskLayerSection } from './layer/TaskLayerSection';
import { TaskLayerConfig, TaskLayerOption } from './layer/task-layer.interface';

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
  autoSearchOnMount?: boolean;
  showAreaSection?: boolean;
  showAdvancedSection?: boolean;
  showBudgetSection?: boolean;
  showLayersSection?: boolean;
  showLayersHeader?: boolean;
}

export const TaskCreateForm = ({
  isReadOnly = false,
  autoSearchOnMount = false,
  showAreaSection = true,
  showAdvancedSection = true,
  showBudgetSection = true,
  showLayersSection = true,
  showLayersHeader = true,
}: TaskCreateFormProps) => {
  const costLayer = COST_LAYER_OPTION;
  const { values, handleChange, touched, errors } = useFormikContext<TaskCreateFormValues>();

  return (
    <>
      <Stack
        sx={{
          flexDirection: 'column',
          gap: 4,
        }}>
        <Stack spacing={2} pt={1}>
          <TextField
            fullWidth
            label="Name"
            name="name"
            value={values.name}
            onChange={handleChange}
            disabled={isReadOnly}
            error={touched.name && Boolean(errors.name)}
            helperText={touched.name && errors.name ? String(errors.name) : ''}
          />
          <TextField
            fullWidth
            label="Description"
            name="description"
            value={values.description ?? ''}
            onChange={handleChange}
            multiline
            minRows={2}
            disabled={isReadOnly}
            error={touched.description && Boolean(errors.description)}
            helperText={touched.description && errors.description ? String(errors.description) : ''}
          />
        </Stack>
        {showAreaSection && (
          <Box>
            <TaskAreaSection isReadOnly={isReadOnly} />
          </Box>
        )}

        {showBudgetSection && (
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
            <TaskBudgetSection costLayer={costLayer} isReadOnly={isReadOnly} />
          </Box>
        )}

        {showLayersSection && (
          <Box>
            {showLayersHeader && (
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
            )}
            <TaskLayerSection isReadOnly={isReadOnly} autoSearchOnMount={autoSearchOnMount} />
          </Box>
        )}

        {showAdvancedSection && (
          <Box>
            <TaskAdvancedSection isReadOnly={isReadOnly} />
          </Box>
        )}
      </Stack>
    </>
  );
};
