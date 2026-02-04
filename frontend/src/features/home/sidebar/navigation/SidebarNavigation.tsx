import { mdiClipboardClockOutline, mdiFolderOutline, mdiLayersTripleOutline } from '@mdi/js';
import Icon from '@mdi/react';
import { Box, Tab, Tabs } from '@mui/material';
import { SidebarView } from 'context/sidebarUIContext';
import React from 'react';

interface SidebarNavigationProps {
  activeView: SidebarView | null;
  onViewChange: (newView: SidebarView | null) => void;
}

export const SidebarNavigation = ({ activeView, onViewChange }: SidebarNavigationProps) => {
  const handleTabClick = (newValue: SidebarView) => {
    if (activeView === newValue) {
      onViewChange(null);
      return;
    }

    onViewChange(newValue);
  };

  return (
    <Box>
      <Tabs
        orientation="vertical"
        value={activeView ?? false}
        indicatorColor="primary"
        textColor="primary"
        sx={{
          '& .MuiTab-root': {
            justifyContent: 'flex-start',
            minHeight: '50px',
            minWidth: '140px',
            gap: 1,
            px: 2,
            textTransform: 'none',
          },
        }}>
        <Tab
          value="tasks"
          icon={<Icon path={mdiClipboardClockOutline} size={1} />}
          iconPosition="start"
          label="Tasks"
          onClick={() => {
            handleTabClick('tasks');
          }}
        />
        <Tab
          value="projects"
          icon={<Icon path={mdiFolderOutline} size={1} />}
          iconPosition="start"
          label="Projects"
          onClick={() => {
            handleTabClick('projects');
          }}
        />
        <Tab
          value="layers"
          icon={<Icon path={mdiLayersTripleOutline} size={1} />}
          iconPosition="start"
          label="Layers"
          onClick={() => {
            handleTabClick('layers');
          }}
        />
      </Tabs>
    </Box>
  );
};
