import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { TooltipStack } from 'components/tooltip/TooltipStack';
import { ControlPanelBudgetForm } from './budget/ControlPanelBudgetForm';
import { ControlPanelLayerForm } from './layer/ControlPanelLayerForm';
import { ControlPanelToolbar } from './toolbar/ControlPanelToolbar';

export const COST_LAYER_PATH = 'financial/cost';
export interface LayerOption {
  path: string;
  name: string;
  description?: string;
  group: string;
}
interface IControlPanelFormProps {
  layerOptions: LayerOption[];
}
export const ControlPanelForm = (props: IControlPanelFormProps) => {
  const { layerOptions } = props;

  const costLayer = layerOptions.find((option) => option.path.includes(COST_LAYER_PATH));

  if (!costLayer) {
    console.error('Failed to find cost layer: ', COST_LAYER_PATH);
  }

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        gap: 3,
        height: '100%',
        overflow: 'auto',
      }}>
      <ControlPanelToolbar />

      <Box>
        <TooltipStack tooltip="Enter the amount of money you have to spend" mb={1}>
          <Typography
            color="textSecondary"
            fontWeight={700}
            textTransform="uppercase"
            letterSpacing={0.5}
            variant="body2">
            Budget
          </Typography>
        </TooltipStack>

        <ControlPanelBudgetForm costLayer={costLayer} />
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
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

        <ControlPanelLayerForm layerOptions={layerOptions} />
      </Box>
    </Box>
  );
};
