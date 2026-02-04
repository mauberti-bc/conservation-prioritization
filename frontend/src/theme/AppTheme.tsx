import { grey } from '@mui/material/colors';
import { alpha, createTheme } from '@mui/material/styles';
import 'styles.scss';
import 'styles/fonts.scss';

export const appTheme = createTheme({
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 960,
      lg: 1440,
      xl: 1720,
    },
  },
  palette: {
    background: {
      default: grey[100],
    },
    primary: {
      light: '#5595D9',
      main: '#1E5189',
      dark: '#003366',
      contrastText: '#ffffff',
    },
    success: {
      light: '#7fc09bff',
      main: '#247827ff',
      dark: '#207030ff',
    },
    error: { light: '#e9898cff', main: '#d72f2fff', dark: '#8c0a0eff' },
    text: {
      primary: '#313132',
      secondary: '#999999ff',
    },
    action: {
      selected: grey[200],
      hover: grey[50],
    },
  },
  typography: {
    fontSize: 15,
    fontFamily: ['BCSans', 'Verdana', 'Arial', 'sans-serif'].join(','),
    h1: {
      fontSize: '1.75rem',
      fontWeight: 700,
      paddingTop: '4px',
      paddingBottom: '8px',
      display: '-webkit-box',
      WebkitLineClamp: '2',
      WebkitBoxOrient: 'vertical',
      maxWidth: '72ch',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    h2: {
      fontSize: '1.5rem',
      fontWeight: 700,
    },
    h3: {
      fontSize: '1.25rem',
      fontWeight: 700,
    },
    h4: {
      fontSize: '1.125rem',
      fontWeight: 700,
    },
    h5: {
      fontSize: '1rem',
      fontWeight: 700,
    },
    h6: {
      fontWeight: 700,
    },
    body1: {
      fontSize: '1rem',
    },
    body2: {
      fontSize: '0.85rem',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        a: {
          color: '#1a5a96',
          '&:focus': {
            outline: '2px solid #3B99FC',
            outlineOffset: '-1px',
            borderRadius: '4px',
          },
        },
        fieldset: {
          margin: 0,
          padding: 0,
          minWidth: 0,
          border: 'none',
        },
        legend: {
          '&.MuiTypography-root': {
            marginBottom: '15px',
            padding: 0,
            fontWeight: 700,
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        outlinedError: {
          background: 'rgb(251, 237, 238)',
        },
      },
    },
    MuiSnackbar: {
      styleOverrides: {
        root: {
          '& .MuiPaper-root': { borderRadius: '6px', padding: '10px 30px 10px 20px' },
        },
      },
    },
    MuiAlertTitle: {
      styleOverrides: {
        root: {
          fontWeight: 700,
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          '&.Mui-focused': {
            backgroundColor: 'inherit',
          },
        },
      },
    },
    MuiBreadcrumbs: {
      styleOverrides: {
        root: {
          marginTop: '-4px',
          marginBottom: '4px',
          marginLeft: '-4px',
        },
        li: {
          maxWidth: '40ch',
          padding: '4px',
          whiteSpace: 'nowrap',
          '& a': {
            display: 'block',
            fontSize: '0.9rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          },
          '& span': {
            fontSize: '0.9rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          },
        },
        separator: {
          marginRight: '4px',
          marginLeft: '4px',
        },
      },
    },
    MuiButtonGroup: {
      defaultProps: { disableElevation: true, disableRipple: true, disableFocusRipple: true },
      styleOverrides: {},
    },
    MuiButton: {
      defaultProps: {},
      styleOverrides: {
        root: {
          whiteSpace: 'nowrap',
          padding: '10px 15px',
          '&:focus': {
            outline: '2px solid #3B99FC',
            outlineOffset: '-1px',
          },
        },
        contained: {
          fontWeight: 700,
        },
        outlined: {
          borderWidth: 1,
          borderColor: 'inherit',
        },
        text: {
          fontWeight: 700,
          fontSize: '0.8rem',
        },
        startIcon: {
          marginBottom: '1px',
        },
        sizeLarge: {
          fontSize: '1rem',
        },
        containedPrimary: {
          fontWeight: 700,
          letterSpacing: '0.02rem',
        },
        containedError: {
          fontWeight: 700,
          letterSpacing: '0.02rem',
        },
        outlinedPrimary: {
          fontWeight: 700,
          letterSpacing: '0.02rem',
        },
      },
    },
    MuiButtonBase: {
      defaultProps: {
        disableRipple: true,
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          minWidth: '6rem',
          borderRadius: '4px',
          textTransform: 'capitalize',
          padding: '10px 5px !important',
          '&.MuiChip-sizeSmall': {
            fontSize: '0.8rem',
          },
        },
      },
    },

    MuiContainer: {
      defaultProps: { disableGutters: false },
      styleOverrides: {
        root: {
          maxWidth: 'xl',
          margin: 'auto',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paperWidthXl: {
          minWidth: '600px',
        },
        paperFullScreen: {
          minWidth: '100%',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          paddingTop: '24px',
          paddingBottom: '8px',
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          paddingTop: '8px !important' /* Any form fields inside this component get clipped if we don't add this */,
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: '24px',
          '& button': {
            minWidth: '6rem',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          '&:focus': {
            outline: '3px solid #3B99FC',
            outlineOffset: '-3px',
          },
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          backgroundColor: '#fff',
        },
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: '6px',
          backgroundColor: '#fff',
          padding: 0,
          '&.Mui-error .MuiOutlinedInput-notchedOutline': {
            borderWidth: '2px',
            top: '-4px',
          },
        },
        input: {
          padding: '12.5px 14px !important',
          margin: 0,
        },
        adornedStart: {
          paddingLeft: '14px !important',
          '& input': {
            padding: '12.5px 8px !important',
          },
        },
        adornedEnd: {
          padding: '0 0px 0 14px !important',
          '& input': {
            padding: '12.5px 0px !important',
          },
        },
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        root: {
          padding: 0, // remove any extra root padding
        },
        inputRoot: {
          padding: '0', // removes internal padding around input
        },
        tag: {
          fontWeight: 400,
          margin: '2px', // optional, controls chip spacing
        },
      },
    },

    MuiLink: {
      styleOverrides: {
        root: {
          textAlign: 'left',
          color: '#1a5a96',
          borderRadius: '1px',
          cursor: 'pointer',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          height: '6px',
          borderRadius: '3px',
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          '&:last-of-type': {
            borderBottom: 'none',
          },
        },
      },
    },
    MuiListItemText: {
      styleOverrides: {
        root: {
          borderRadius: '3px',
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: {
          minWidth: '42px',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: {
          borderRadius: '8px',
        },
      },
    },
    MuiTable: {
      styleOverrides: {
        root: {
          fontSize: '0.875rem',
          '& tr:last-of-type td': {
            borderBottom: 'none',
          },
          '& thead': {
            background: grey[50],
          },
          '& th': {
            letterSpacing: '0.02rem',
            textTransform: 'uppercase',
            paddingTop: '12px',
            paddingBottom: '12px',
            height: '52px',
          },
          '& td': {
            height: '52px',
          },
          '& th:first-of-type, td:first-of-type': {
            paddingLeft: '16px',
          },
          '& th:last-of-type, td:last-of-type': {
            paddingRight: '16px',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          paddingRight: '8px',
          paddingLeft: '8px',
        },
        head: {
          fontSize: '0.875rem',
          fontWeight: 700,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          minWidth: '100px !important',
          fontWeight: 700,
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          fontWeight: 700,
          padding: '8px',
          border: 'none',
          outline: 'none',
          '&.Mui-selected': {
            backgroundColor: alpha('#07509aff', 0.1),
            outline: `2px solid ${alpha('#07509aff', 0.2)}`,
            zIndex: 1,
          },
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          '& h2, h3': {
            fontSize: '1.125rem',
          },
          minHeight: '0 !important',
        },
      },
    },
  },
});

declare module '@mui/material/styles' {
  interface Palette {
    bcgovblue: Palette['primary'];
  }

  // allow configuration using `createTheme`
  interface PaletteOptions {
    bcgovblue?: PaletteOptions['primary'];
  }
}

// Update the Button's color prop options
declare module '@mui/material/Button' {
  interface ButtonPropsColorOverrides {
    bcgovblue: true;
  }
}
