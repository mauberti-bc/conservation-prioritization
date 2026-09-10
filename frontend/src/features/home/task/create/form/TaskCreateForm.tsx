import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { CustomAutocomplete } from 'components/input/CustomAutocomplete';
import { TooltipStack } from 'components/tooltip/TooltipStack';
import { useFormikContext } from 'formik';
import { Feature } from 'geojson';
import { OPTIMIZATION_MODE, RESAMPLING, TASK_TYPE } from 'hooks/interfaces/useTaskApi.interface';
import { TaskAreaSection } from './area/TaskAreaSection';
import { TaskConstraintSection } from './constraint/TaskConstraintSection';
import { TaskConstraintConfig, TaskObjectiveConfig } from './layer/optimization-form.interface';
import { TaskObjectiveSection } from './layer/TaskObjectiveSection';

export const DEFAULT_TASK_CREATE_NAME = 'Untitled';

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
    label: 'Discrete',
    value: 'discrete_optimization',
    description: 'Select planning units under the configured constraints',
  },
  {
    label: 'Continuous',
    value: 'continuous_optimization',
    description: 'Allocate fractional conservation intensity under the configured constraints',
  },
  {
    label: 'Priority',
    value: 'priority_ranking',
    description: 'Rank conservation priority from nested allocation persistence',
  },
];

interface TaskCreateFormProps {
  isReadOnly?: boolean;
  autoSearchOnMount?: boolean;
  showAreaSection?: boolean;
}

export const TaskCreateForm = ({
  isReadOnly = false,
  autoSearchOnMount = false,
  showAreaSection = true,
}: TaskCreateFormProps) => {
  const { values, setFieldValue } = useFormikContext<TaskCreateFormValues>();

  return (
    <Stack
      sx={{
        flexDirection: 'column',
        gap: 3,
      }}>
      <Box pt={1}>
        <CustomAutocomplete
          label="Mode"
          options={TASK_TYPE_OPTIONS}
          value={TASK_TYPE_OPTIONS.find((option) => option.value === values.type)}
          handleSelect={(option) => setFieldValue('type', option.value)}
          disableClearable
          disabled={isReadOnly}
          width="100%"
        />
      </Box>

      {showAreaSection && (
        <Box>
          <TaskAreaSection isReadOnly={isReadOnly} />
        </Box>
      )}

      <Stack gap={1} flex={0}>
        <TooltipStack
          tooltip="Constraint layers set limits for the analysis, such as cost, area, or other layer-specific resources. They restrict eligible solutions without adding conservation value."
          mb={1}>
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
      </Stack>

      <Stack gap={1}>
        <TooltipStack
          tooltip="Objective layers define what the analysis should prioritize. Set each layer's direction and importance to favor conservation values or avoid risks."
          mb={1}>
          <Typography
            color="textSecondary"
            fontWeight={700}
            textTransform="uppercase"
            letterSpacing={0.5}
            variant="body2">
            Objectives
          </Typography>
        </TooltipStack>
        <TaskObjectiveSection isReadOnly={isReadOnly} autoSearchOnMount={autoSearchOnMount} />
      </Stack>
    </Stack>
  );
};
