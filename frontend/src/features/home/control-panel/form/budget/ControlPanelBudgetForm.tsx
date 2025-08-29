import { mdiCurrencyUsd } from '@mdi/js';
import Icon from '@mdi/react';
import { Box, TextField } from '@mui/material';
import { grey } from '@mui/material/colors';
import { useFormikContext } from 'formik';
import { formatBudget } from 'utils/currency';
import { FormValues } from '../../ControlPanel';
import { LayerOption } from '../ControlPanelForm';
import { initialLayerValues, Layer } from '../layer/layer.interface';

const MAX_DIGITS = 15;

interface IControlPanelBudgetFormProps {
  costLayer?: LayerOption;
}

export const ControlPanelBudgetForm = ({ costLayer }: IControlPanelBudgetFormProps) => {
  const { values, setFieldValue } = useFormikContext<FormValues>();

  const targetLayer = values.budget?.path === costLayer?.path ? values.budget : null;
  const existingMax = targetLayer?.constraints.find((c) => c.type === 'unit')?.max ?? null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value.slice(0, MAX_DIGITS);
    const numeric = input.replace(/,/g, '').trim();

    const parsed = numeric !== '' ? Number(numeric) : null;
    const isValid = parsed !== null && !isNaN(parsed);

    if (!isValid) {
      setFieldValue('budget', null);
      return;
    }

    const maxValue = parsed;

    if (targetLayer) {
      // Update existing constraint
      const updatedConstraints = [...targetLayer.constraints];
      const constraintIndex = updatedConstraints.findIndex((c) => c.type === 'unit');

      if (constraintIndex !== -1) {
        updatedConstraints[constraintIndex] = {
          ...updatedConstraints[constraintIndex],
          max: maxValue,
        };
      } else {
        updatedConstraints.push({
          id: crypto.randomUUID(),
          type: 'unit',
          min: null,
          max: maxValue,
        });
      }

      const updatedLayer: Layer = {
        ...targetLayer,
        constraints: updatedConstraints,
      };

      setFieldValue('budget', updatedLayer);
    } else {
      // Create new budget layer
      const newLayer: Layer = {
        ...initialLayerValues,
        ...costLayer,
        importance: -100, // Maximum negative
        constraints: [
          {
            id: crypto.randomUUID(),
            type: 'unit',
            min: null,
            max: maxValue,
          },
        ],
      };

      setFieldValue('budget', newLayer);
    }
  };

  return (
    <Box display="flex" alignItems="center" gap={2} mb={1} width="100%">
      <TextField
        placeholder={costLayer ? 'Unlimited' : 'Failed to find cost layer'}
        value={existingMax !== null ? formatBudget(existingMax.toString()) : ''}
        onChange={handleChange}
        fullWidth
        disabled={!costLayer}
        slotProps={{
          input: {
            startAdornment: <Icon path={mdiCurrencyUsd} size={1} style={{ color: grey[500] }} />,
          },
        }}
      />
    </Box>
  );
};
