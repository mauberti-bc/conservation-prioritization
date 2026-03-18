import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { TaskAdvancedSection } from '../../form/advanced/TaskAdvancedSection';

interface TaskSubmitPanelFooterProps {
  isSubmitting: boolean;
}

export const TaskSubmitPanelFooter = ({ isSubmitting }: TaskSubmitPanelFooterProps) => {
  return (
    <Box
      mr={0.5}
      py={2}
      sx={{
        boxShadow: '0px -2px 25px 0px rgba(0,0,0,0.05)',
        position: 'sticky',
        bottom: 0,
        backgroundColor: 'white',
      }}>
      <Box mx={3} mb={2}>
        <TaskAdvancedSection />
      </Box>
      <Box mx={3}>
        <Button variant="contained" size="large" loading={isSubmitting} type="submit" color="primary" fullWidth>
          Submit
        </Button>
      </Box>
    </Box>
  );
};
