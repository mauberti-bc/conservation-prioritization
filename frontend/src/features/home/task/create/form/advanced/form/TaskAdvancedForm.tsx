import Stack from '@mui/material/Stack';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { CustomAutocomplete } from 'components/input/CustomAutocomplete';
import { useFormikContext } from 'formik';
import { OPTIMIZATION_MODE } from 'hooks/interfaces/useTaskApi.interface';
import { TaskCreateFormValues } from '../../TaskCreateForm';
import { TaskAdvancedInputRow } from './row/TaskAdvancedInputRow';

const optimizationModeOptions = [
  {
    label: 'Interactive',
    value: OPTIMIZATION_MODE.INTERACTIVE,
    description: 'Feasible result with up to 30 minutes of solver time',
  },
  {
    label: 'Balanced',
    value: OPTIMIZATION_MODE.BALANCED,
    description: 'Tighter quality bound with up to 2 hours of solver time',
  },
  {
    label: 'Exact audit',
    value: OPTIMIZATION_MODE.EXACT_AUDIT,
    description: 'Prove optimality with up to 24 hours of solver time',
  },
];

const resolutionOptions = [
  { label: '30 m — highest cost', value: 30 },
  { label: '60 m', value: 60 },
  { label: '120 m', value: 120 },
  { label: '240 m — recommended', value: 240 },
  { label: '480 m', value: 480 },
  { label: '960 m', value: 960 },
  { label: '1,920 m — lowest cost', value: 1920 },
];

interface TaskAdvancedFormProps {
  isReadOnly?: boolean;
}

export const TaskAdvancedForm = ({ isReadOnly = false }: TaskAdvancedFormProps) => {
  const { values, setFieldValue } = useFormikContext<TaskCreateFormValues>();
  const selectedResolution = resolutionOptions.find((option) => {
    return option.value === values.resolution;
  });
  const selectedMode = optimizationModeOptions.find((option) => {
    return option.value === values.optimizationMode;
  });

  if (isReadOnly) {
    return (
      <Stack gap={2} flex="1 1 auto" width="100%">
        <Stack gap={0.25}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Optimization planning units
          </Typography>
          <Typography variant="body2">{selectedResolution?.label ?? values.resolution}</Typography>
        </Stack>

        <Stack gap={0.25}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Evidence resolution
          </Typography>
          <Typography variant="body2">Source-layer resolution (typically 30 m)</Typography>
        </Stack>

        <Stack gap={0.25}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Optimization Mode
          </Typography>
          <Typography variant="body2">{selectedMode?.label ?? values.optimizationMode}</Typography>
        </Stack>

        <Stack gap={0.25}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Neighbor preference
          </Typography>
          <Typography variant="body2">
            {values.neighborPenaltyEnabled ? `Enabled (strength ${values.neighborPenaltyStrength})` : 'Disabled'}
          </Typography>
        </Stack>
      </Stack>
    );
  }

  return (
    <Stack gap={2} flex="1 1 auto" width="100%">
      <TaskAdvancedInputRow
        label="Optimization planning units"
        tooltip="The size of each decision unit. Source evidence keeps its published resolution and scientifically defined aggregation. Finer units cost more to analyze.">
        <CustomAutocomplete
          options={resolutionOptions}
          value={resolutionOptions.find((o) => o.value === values.resolution)}
          handleSelect={(option) => setFieldValue('resolution', option.value)}
          disableClearable
          disabled={isReadOnly}
          sx={{ width: 250 }}
        />
      </TaskAdvancedInputRow>

      <TaskAdvancedInputRow
        label="Neighbor preference"
        tooltip="Softly rewards rook-adjacent planning units receiving allocation together. Strength is a normalized relative preference comparable to objective importance; it encourages coherent patches but does not require connectivity.">
        <Stack direction="row" gap={2} alignItems="center">
          <FormControlLabel
            control={
              <Switch
                checked={values.neighborPenaltyEnabled}
                onChange={(event) => setFieldValue('neighborPenaltyEnabled', event.target.checked)}
              />
            }
            label="Enable"
          />
          <TextField
            name="neighborPenaltyStrength"
            label="Strength"
            type="number"
            value={values.neighborPenaltyStrength}
            disabled={!values.neighborPenaltyEnabled}
            onChange={(event) => setFieldValue('neighborPenaltyStrength', Number(event.target.value))}
            slotProps={{ htmlInput: { min: 0, step: 0.1 } }}
            sx={{ width: 140 }}
          />
        </Stack>
      </TaskAdvancedInputRow>

      <TaskAdvancedInputRow
        label="Evidence resolution"
        tooltip="Evidence resolution is declared independently by each immutable source layer. Aggregation is defined by that layer's scientific contract.">
        <Typography variant="body2">Source-layer resolution (typically 30 m)</Typography>
      </TaskAdvancedInputRow>

      <TaskAdvancedInputRow
        label="Optimization Mode"
        tooltip="Interactive and Balanced return feasible results within bounded work. Exact audit is for runs that require an optimality proof.">
        <CustomAutocomplete
          options={optimizationModeOptions}
          value={optimizationModeOptions.find((o) => o.value === values.optimizationMode)}
          handleSelect={(option) => setFieldValue('optimizationMode', option.value)}
          disableClearable
          disabled={isReadOnly}
          sx={{ width: 250 }}
        />
      </TaskAdvancedInputRow>
    </Stack>
  );
};
