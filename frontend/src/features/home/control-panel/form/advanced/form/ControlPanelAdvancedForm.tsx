import Stack from '@mui/material/Stack';
import { CustomAutocomplete } from 'components/input/CustomAutocomplete';
import { FormValues } from 'features/home/control-panel/ControlPanel';
import { useFormikContext } from 'formik';
import { AdvancedFormInputRow } from './row/AdvancedFormInputRow';

export enum OPTIMIZATION_VARIANT {
  STRICT = 'strict',
  APPROXIMATE = 'approximate',
}

const optimizationModeOptions = [
  { label: 'Strict', value: OPTIMIZATION_VARIANT.STRICT, description: 'Only show results that meet all constraints' },
  {
    label: 'Approximate',
    value: OPTIMIZATION_VARIANT.APPROXIMATE,
    description: 'Show results that may violate constraints',
  },
];

const resolutionOptions = [
  { label: 30, value: 30 },
  { label: 100, value: 100 },
  { label: 250, value: 250 },
  { label: 500, value: 500 },
  { label: 1000, value: 1000 },
  { label: 5000, value: 5000 },
];

const resamplingOptions = [
  { label: 'Mode', value: 'mode', description: 'Use the most common value' },
  { label: 'Max', value: 'max', description: 'Use the highest value' },
  { label: 'Min', value: 'min', description: 'Use the lowest value' },
];

export const ControlPanelAdvancedForm = () => {
  const { values, setFieldValue } = useFormikContext<FormValues>();

  return (
    <Stack gap={2} flex="1 1 auto" width="100%">
      <AdvancedFormInputRow
        label="Resolution (metres)"
        tooltip="The resolution that layers will be converted to for the analysis. High resolution (>250m) may produce inaccurate results.">
        <CustomAutocomplete
          options={resolutionOptions}
          value={resolutionOptions.find((o) => o.value === values.resolution)}
          handleSelect={(option) => setFieldValue('resolution', option.value)}
          disableClearable
          sx={{ width: 250 }}
        />
      </AdvancedFormInputRow>

      <AdvancedFormInputRow
        label="Resampling Method"
        tooltip="The method used to resolve conflicting values when the resolution increases.">
        <CustomAutocomplete
          options={resamplingOptions}
          value={resamplingOptions.find((o) => o.value === values.resampling)}
          handleSelect={(option) => setFieldValue('resampling', option.value)}
          disableClearable
          sx={{ width: 250 }}
        />
      </AdvancedFormInputRow>

      <AdvancedFormInputRow
        label="Optimization Mode"
        tooltip="The method used to resolve conflicting values when the resolution increases.">
        <CustomAutocomplete
          options={optimizationModeOptions}
          value={optimizationModeOptions.find((o) => o.value === values.variant)}
          handleSelect={(option) => setFieldValue('variant', option.value)}
          disableClearable
          sx={{ width: 250 }}
        />
      </AdvancedFormInputRow>
    </Stack>
  );
};
