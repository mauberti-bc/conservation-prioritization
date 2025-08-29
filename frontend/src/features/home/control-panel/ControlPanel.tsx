import { mdiCheck } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { Formik } from 'formik';
import { Feature } from 'geojson';
import { OptimizationParameters } from 'hooks/api/usePrefectApi.interface';
import { useConservationApi } from 'hooks/useConservationApi';
import { useConfigContext, useDialogContext } from 'hooks/useContext';
import { useZarr } from 'hooks/useZarr';
import { useMemo, useState } from 'react';
import yup from 'utils/yup';
import { ControlPanelAdvanced } from './form/advanced/ControlPanelAdvanced';
import { OPTIMIZATION_VARIANT } from './form/advanced/form/ControlPanelAdvancedForm';
import { ControlPanelForm, LayerOption } from './form/ControlPanelForm';
import { Layer } from './form/layer/layer.interface';

const constraintSchema = yup
  .object({
    min: yup.number().typeError('Minimum value must be a number').nullable(),

    max: yup.number().typeError('Maximum value must be a number').nullable(),

    type: yup
      .mixed<'percent' | 'unit'>()
      .oneOf(['percent', 'unit'], 'Invalid constraint type')
      .required('Constraint type is required'),
  })
  .test({
    name: 'at-least-one-of-min-max',
    message: 'You must specify the min or max for each constraint',
    test: function (value) {
      const { min, max } = value || {};
      return min != null || max != null;
    },
  });

const layerSchema = yup.object({
  name: yup.string().required('Layer name is required'),
  path: yup.string().required('Array path is required'),
  mode: yup.string().oneOf(['flexible', 'locked-in', 'locked-out']).required('Mode is required'),
  importance: yup.number().when('mode', {
    is: 'flexible',
    then: (schema) =>
      schema
        .required('Importance is required when mode is flexible')
        .test(
          'importance-range',
          'You must adjust the influence of the layer',
          (value) =>
            value !== undefined && value !== 0 && ((value >= -100 && value <= -1) || (value >= 1 && value <= 100))
        ),
    otherwise: (schema) => schema.notRequired(),
  }),
  threshold: yup
    .number()
    .when('mode', {
      is: 'locked-in',
      then: (schema) => schema.required('Threshold is required when mode is locked-in'),
      otherwise: (schema) => schema.notRequired(),
    })
    .when('mode', {
      is: 'locked-out',
      then: (schema) => schema.required('Threshold is required when mode is locked-out'),
      otherwise: (schema) => schema.notRequired(),
    }),
  constraints: yup.array().of(constraintSchema).optional(),
});

const validationSchema = yup.object({
  variant: yup.string().oneOf([OPTIMIZATION_VARIANT.APPROXIMATE, OPTIMIZATION_VARIANT.STRICT]),
  layers: yup.array().of(layerSchema).required('Layers are required').min(1, 'At least one layer is required'),
  name: yup.string().required('You must name the conservation scenario'),
  budget: yup
    .object({
      name: yup.string().required('Layer name is required'),
      path: yup.string().required('Array path is required'),
      constraints: yup.array().of(constraintSchema).optional(),
    })
    .nullable(),
  resolution: yup
    .number()
    .oneOf([30, 100, 250, 500, 1000, 5000], 'Resolution must be an allowed value')
    .required('Resolution is required'),
  resampling: yup
    .string()
    .oneOf(['mode', 'min', 'max'], 'Resampling method must be an allowed value')
    .required('Resampling method is required'),
});

type RESAMPLING = 'mode' | 'min' | 'max';

export interface FormValues {
  resolution: number;
  resampling: RESAMPLING;
  name: string;
  variant: OPTIMIZATION_VARIANT;
  budget: Layer | null;
  layers: Layer[];
  geometry: Feature[];
}

const initialValues: FormValues = {
  resolution: 1000,
  resampling: 'mode',
  name: 'New Conservation Scenario',
  variant: OPTIMIZATION_VARIANT.STRICT,
  budget: null,
  layers: [],
  geometry: [],
};

export const ControlPanel = () => {
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const conservationApi = useConservationApi();
  const dialogContext = useDialogContext();
  const configContext = useConfigContext();

  // Read this from my /data/species.zarr store instead using zarrita.js
  const zarr = useZarr(configContext.ZARR_STORE_PATH);

  const layerOptions: LayerOption[] = useMemo(
    () =>
      zarr.variables.map((variable) => ({
        path: variable.path,
        name: variable.name,
        description: variable.description,
        group: variable.group,
      })),
    [zarr]
  );

  const handleToggleAdvanced = () => {
    setAdvancedOpen((prev) => !prev);
  };

  const handleSubmit = async (values: FormValues) => {
    setIsSubmitting(true);

    try {
      const { layers, variant, budget, ...formValues } = values;

      const conditions: OptimizationParameters = {
        ...formValues,
        layers: {},
      };

      const combinedLayers = [...layers, ...(budget ? [budget] : [])];

      for (const layer of combinedLayers) {
        conditions.layers[layer.path] = {
          mode: layer.mode,
          importance: layer.mode === 'flexible' ? layer.importance : undefined,
          threshold: layer.mode === 'locked-in' || layer.mode === 'locked-out' ? layer.threshold : undefined,
          constraints: layer.constraints.length > 0 ? layer.constraints : undefined,
        };
      }

      if (variant === OPTIMIZATION_VARIANT.STRICT) {
        await conservationApi.prefect.submitStrictOptimizationRun(conditions);

        dialogContext.setSnackbar({
          open: true,
          snackbarMessage: (
            <Stack flexDirection="row" gap={1}>
              <Icon path={mdiCheck} size={1} />
              Successfully started processing
            </Stack>
          ),
        });
      }
    } catch (error) {
      console.error(error);
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: 'Failed to submit optimization run',
      });
    } finally {
      setTimeout(() => setIsSubmitting(false), 500);
    }
  };

  return (
    <Formik
      initialValues={initialValues}
      onSubmit={handleSubmit}
      validationSchema={validationSchema}
      validateOnChange={false}
      validateOnMount={false}
      validateOnBlur={false}>
      {({ handleSubmit, values }) => {
        return (
          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <Box
              sx={{
                flex: 1,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                pt: 2,
                px: 3,
              }}>
              <ControlPanelForm layerOptions={layerOptions} />
            </Box>

            {/* Sticky footer */}
            <Box
              py={2}
              sx={{
                boxShadow: '0px -2px 25px 0px rgba(0,0,0,0.05)',
                position: 'sticky',
                bottom: 0,
                backgroundColor: 'white',
              }}>
              <Stack gap={1} px={3} alignItems="flex-start">
                <ControlPanelAdvanced open={advancedOpen} handleClick={handleToggleAdvanced} />

                <Button
                  loading={isSubmitting}
                  sx={{ py: 2 }}
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={!values.layers.length}>
                  Submit
                </Button>
              </Stack>
            </Box>
          </Box>
        );
      }}
    </Formik>
  );
};
