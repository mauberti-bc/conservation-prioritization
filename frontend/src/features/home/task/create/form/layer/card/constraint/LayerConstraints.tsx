import { Stack } from '@mui/system';
import { TaskLayerConfig } from '../../task-layer.interface';
import { LayerConstraint } from './item/LayerConstraintItem';

interface Props {
  layer: TaskLayerConfig;
  onLayerChange: (original: TaskLayerConfig, updated: TaskLayerConfig) => void;
}

export const LayerConstraints = ({ layer, onLayerChange }: Props) => {
  const handleConstraintChange = (index: number, updatedConstraint: LayerConstraint) => {
    const updatedConstraints = [...layer.constraints];
    updatedConstraints[index] = updatedConstraint;
    onLayerChange(layer, { ...layer, constraints: updatedConstraints });
  };

  const handleRemove = (constraint: LayerConstraint) => {
    onLayerChange(layer, {
      ...layer,
      constraints: layer.constraints.filter((existing) => constraint.id !== existing.id),
    });
  };

  return (
    <Stack spacing={2} flex="1 1 auto" width="100%">
      {layer.constraints.map((constraint, index) => (
        <LayerConstraint
          key={constraint.id}
          constraint={constraint}
          onChange={(updated) => handleConstraintChange(index, updated)}
          onRemove={handleRemove}
        />
      ))}
    </Stack>
  );
};
