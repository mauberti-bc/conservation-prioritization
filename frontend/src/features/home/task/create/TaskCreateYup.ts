import { OPTIMIZATION_MODE } from 'hooks/interfaces/useTaskApi.interface';
import yup from 'utils/yup';

const constraintSchema = yup
  .object({
    min: yup.number().typeError('Minimum value must be a number').nullable(),
    max: yup.number().typeError('Maximum value must be a number').nullable(),
    type: yup.mixed<'aggregate' | 'planning_unit'>().oneOf(['aggregate', 'planning_unit']).required(),
    layer: yup.string().required('Layer is required'),
  })
  .test({
    name: 'at-least-one-of-min-max',
    message: 'You must specify the min or max for each constraint',
    test: function (value) {
      const { min, max } = value || {};
      return min != null || max != null;
    },
  })
  .test({
    name: 'ordered-bounds',
    message: 'Minimum cannot exceed maximum',
    test: ({ min, max }) => min == null || max == null || min <= max,
  });

const layerSchema = yup.object({
  name: yup.string().required('Layer name is required'),
  path: yup.string().required('Array path is required'),
  direction: yup.string().oneOf(['maximize', 'minimize']).required('Direction is required'),
  importance: yup.number().min(0).max(100).required('Importance is required'),
});

export const taskValidationSchema = yup.object({
  type: yup
    .string()
    .oneOf(['continuous_optimization', 'discrete_optimization', 'priority_ranking'])
    .required('Analysis type is required'),
  optimizationMode: yup
    .string()
    .oneOf([OPTIMIZATION_MODE.INTERACTIVE, OPTIMIZATION_MODE.BALANCED, OPTIMIZATION_MODE.EXACT_AUDIT])
    .required(),
  neighborPenaltyEnabled: yup.boolean().required(),
  neighborPenaltyStrength: yup.number().when('neighborPenaltyEnabled', {
    is: true,
    then: (schema) => schema.moreThan(0).required('Neighbor preference strength is required'),
  }),
  objectives: yup.array().of(layerSchema).min(1, 'At least one objective is required').required(),
  constraints: yup.array().of(constraintSchema).required(),
  targetArea: yup.array().min(1, 'A target area is required').required(),
  name: yup.string().required('You must name the conservation scenario'),
  resolution: yup
    .number()
    .oneOf([30, 60, 120, 240, 480, 960, 1920], 'Planning-unit resolution must be an allowed grid level')
    .required('Resolution is required'),
  resampling: yup
    .string()
    .oneOf(['mode', 'min', 'max'], 'Resampling method must be an allowed value')
    .required('Resampling method is required'),
});
