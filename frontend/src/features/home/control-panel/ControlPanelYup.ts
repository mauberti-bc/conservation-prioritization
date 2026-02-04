import yup from 'utils/yup';
import { OPTIMIZATION_VARIANT } from './form/advanced/form/ControlPanelAdvancedForm';

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

export const taskValidationSchema = yup.object({
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
