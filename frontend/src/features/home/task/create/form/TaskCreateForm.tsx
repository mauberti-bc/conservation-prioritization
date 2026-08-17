import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { CustomAutocomplete } from 'components/input/CustomAutocomplete';
import { TooltipStack } from 'components/tooltip/TooltipStack';
import { useFormikContext } from 'formik';
import { Feature } from 'geojson';
import { OPTIMIZATION_MODE, RESAMPLING, TASK_TYPE } from 'hooks/interfaces/useTaskApi.interface';
import { TaskAdvancedSection } from './advanced/TaskAdvancedSection';
import { TaskAdvancedForm } from './advanced/form/TaskAdvancedForm';
import { TaskAreaSection } from './area/TaskAreaSection';
import { TaskConstraintSection } from './constraint/TaskConstraintSection';
import { TaskConstraintConfig, TaskObjectiveConfig } from './layer/optimization-form.interface';
import { TaskObjectiveSection } from './layer/TaskObjectiveSection';

export interface TaskCreateFormValues {
  type: TASK_TYPE;
  resolution: number;
  resampling: RESAMPLING;
  name: string;
  description: string | null;
  optimizationMode: OPTIMIZATION_MODE;
  neighborPenaltyEnabled: boolean;
  neighborPenaltyStrength: number;
  objectives: TaskObjectiveConfig[];
  constraints: TaskConstraintConfig[];
  targetArea: { id: string; name: string; description: string | null; geojson: Feature; mapboxFeatureId: string }[];
}

const TASK_TYPE_OPTIONS: { label: string; value: TASK_TYPE; description: string }[] = [
  {
    label: 'Discrete optimization',
    value: 'discrete_optimization',
    description: 'Select planning units under the configured constraints',
  },
  {
    label: 'Continuous optimization',
    value: 'continuous_optimization',
    description: 'Allocate fractional conservation intensity under the configured constraints',
  },
  {
    label: 'Priority ranking',
    value: 'priority_ranking',
    description: 'Rank conservation priority from nested allocation persistence',
  },
];

interface TaskCreateFormProps {
  isReadOnly?: boolean;
  autoSearchOnMount?: boolean;
  showAreaSection?: boolean;
  showAdvancedSection?: boolean;
  showConstraintsSection?: boolean;
  showLayersSection?: boolean;
  showLayersHeader?: boolean;
}

export const TaskCreateForm = ({
  isReadOnly = false,
  autoSearchOnMount = false,
  showAreaSection = true,
  showAdvancedSection = true,
  showConstraintsSection = true,
  showLayersSection = true,
  showLayersHeader = true,
}: TaskCreateFormProps) => {
  const { values, handleChange, setFieldValue, touched, errors } = useFormikContext<TaskCreateFormValues>();

  return (
    <>
      <Stack
        sx={{
          flexDirection: 'column',
          gap: 4,
        }}>
        <Stack spacing={2} pt={1}>
          <CustomAutocomplete
            label="Task type"
            options={TASK_TYPE_OPTIONS}
            value={TASK_TYPE_OPTIONS.find((option) => option.value === values.type)}
            handleSelect={(option) => setFieldValue('type', option.value)}
            disableClearable
            disabled={isReadOnly}
            width="100%"
          />
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

        {showConstraintsSection && (
          <Box flex={0}>
            <TooltipStack tooltip="Enter the amount of money you have to spend" mb={1}>
              <Typography
                color="textSecondary"
                fontWeight={700}
                textTransform="uppercase"
                letterSpacing={0.5}
                variant="body2">
                Constraints
              </Typography>
            </TooltipStack>
            <TaskConstraintSection isReadOnly={isReadOnly} autoSearchOnMount={autoSearchOnMount} />
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
            <TaskObjectiveSection isReadOnly={isReadOnly} autoSearchOnMount={autoSearchOnMount} />
          </Box>
        )}

        {showAdvancedSection && <Box>{isReadOnly ? <TaskAdvancedForm isReadOnly /> : <TaskAdvancedSection />}</Box>}
      </Stack>
    </>
  );
};
