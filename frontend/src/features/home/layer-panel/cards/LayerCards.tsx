import { LayerOption } from 'features/home/control-panel/form/ControlPanelForm';
import { LayerCardItem } from './item/LayerCardItem';

interface ILayerCardsProps {
  layers: LayerOption[];
}

export const LayerCards = (props: ILayerCardsProps) => {
  const { layers } = props;

  return (
    <>
      {layers.map((layer) => (
        <LayerCardItem layer={layer} checked={false} />
      ))}
    </>
  );
};
