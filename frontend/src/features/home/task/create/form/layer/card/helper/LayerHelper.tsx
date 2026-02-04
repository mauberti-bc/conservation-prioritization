import { mdiClose, mdiLightbulbOnOutline } from '@mdi/js';
import Icon from '@mdi/react';
import { Box, Button, IconButton, Paper, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { appTheme } from 'theme/AppTheme';

interface TooltipPosition {
  top: number;
  left: number;
}

const helpTexts = {
  layer: {
    title: 'Layer',
    text: 'The slider changes how strongly the layer affects the results, and whether high values in the layer are considered good or bad.',
  },
  slider: {
    title: 'Importance',
    text: 'This slider adjusts the relative importance of the layer.',
  },
  mode: {
    title: 'Mode',
    text: 'Choose how this layer should be treated in the analysis.',
  },
  constraints: {
    title: 'Constraints',
    text: 'Add constraints that limit or guide how this layer can be used.',
  },
};

const renderOrder = ['layer', 'slider', 'mode', 'constraints'] as const;

interface ILayerHelpProps {
  open: boolean;
}

export const LayerHelper = (props: ILayerHelpProps) => {
  const { open } = props;

  const [positions, setPositions] = useState<Record<(typeof renderOrder)[number], TooltipPosition | null>>({
    layer: null,
    slider: null,
    mode: null,
    constraints: null,
  });

  const [activeStep, setActiveStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const updatePositions = () => {
      const layer = document.getElementById('layer-item')?.getBoundingClientRect();
      const slider = document.getElementById('importance-slider')?.getBoundingClientRect();
      const mode = document.getElementById('mode-toggle')?.getBoundingClientRect();
      const constraints = document.getElementById('layer-constraints')?.getBoundingClientRect();

      setPositions({
        layer: layer ? { top: layer.top + window.scrollY, left: layer.left + layer.width + 12 } : null,
        slider: slider ? { top: slider.top + window.scrollY - 70, left: slider.left + slider.width / 2 - 100 } : null,
        mode: mode ? { top: mode.top + window.scrollY - 60, left: mode.left } : null,
        constraints: constraints ? { top: constraints.top + window.scrollY - 60, left: constraints.left } : null,
      });
    };

    updatePositions();
    window.addEventListener('resize', updatePositions);
    window.addEventListener('scroll', updatePositions);
    return () => {
      window.removeEventListener('resize', updatePositions);
      window.removeEventListener('scroll', updatePositions);
    };
  }, [open]);

  const key = renderOrder[activeStep];
  const current = helpTexts[key];
  const position = positions[key];

  const handleNext = () => {
    if (activeStep < renderOrder.length - 1) {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (activeStep > 0) {
      setActiveStep((prev) => prev - 1);
    }
  };

  const handleClose = () => {
    setDismissed(true);
  };

  if (!position || dismissed || !open) {
    return null;
  }

  return (
    <TooltipBox
      position={position}
      title={current.title}
      onClose={handleClose}
      onNext={handleNext}
      onPrevious={handlePrevious}
      disablePrevious={activeStep === 0}
      disableNext={activeStep === renderOrder.length - 1}>
      {current.text}
    </TooltipBox>
  );
};

const TooltipBox = ({
  position,
  title,
  children,
  onClose,
  onNext,
  onPrevious,
  disableNext,
  disablePrevious,
}: {
  position: TooltipPosition;
  title: string;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  disableNext: boolean;
  disablePrevious: boolean;
  children: React.ReactNode;
}) => (
  <Paper
    elevation={4}
    sx={{
      position: 'absolute',
      top: position.top,
      left: position.left,
      zIndex: 9999,
      minWidth: 200,
      maxWidth: 400,
      padding: 1.5,
      border: '1px solid #ccc',
      borderRadius: 1,
      backgroundColor: 'white',
      boxShadow: 3,
    }}>
    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
      <Stack gap={1} display="flex" alignItems="center" flexDirection="row">
        <Icon path={mdiLightbulbOnOutline} size={1} style={{ color: appTheme.palette.primary.main }} />
        <Typography variant="subtitle2" fontWeight={600}>
          {title}
        </Typography>
      </Stack>
      <IconButton onClick={onClose} size="small" sx={{ padding: 0.5 }}>
        <Icon path={mdiClose} size={1} />
      </IconButton>
    </Box>
    <Typography color="textSecondary">{children}</Typography>
    <Box display="flex" alignItems="center" justifyContent="space-between" mt={2}>
      {!disablePrevious && (
        <Button size="small" onClick={onPrevious} sx={{ mr: 'auto' }}>
          Previous
        </Button>
      )}
      {!disableNext && (
        <Button size="small" onClick={onNext} sx={{ ml: 'auto' }}>
          Next
        </Button>
      )}
      {disableNext && (
        <Button size="small" onClick={onNext} sx={{ ml: 'auto' }}>
          Finish
        </Button>
      )}
    </Box>
  </Paper>
);
