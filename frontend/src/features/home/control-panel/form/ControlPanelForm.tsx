import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Stack } from '@mui/system';
import { TooltipStack } from 'components/tooltip/TooltipStack';
import { ControlPanelAdvanced } from './advanced/ControlPanelAdvanced';
import { ControlPanelAreaForm } from './area/ControlPanelAreaForm';
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

  return (
    <>
      <ControlPanelToolbar />
      <Stack
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
        }}>
        <Box>
          <ControlPanelAreaForm />
        </Box>

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

        <Box>
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

        <Box>
          <ControlPanelAdvanced />
        </Box>
      </Stack>
    </>
  );
};
