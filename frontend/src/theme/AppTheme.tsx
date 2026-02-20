import { grey } from '@mui/material/colors';
import { alpha, createTheme } from '@mui/material/styles';
import 'styles.scss';
import 'styles/fonts.scss';

const disabledInputBackground = grey[50];

declare module '@mui/material/styles' {
  interface Palette {
    selected: Palette['primary'];
  }

  interface PaletteOptions {
    selected?: PaletteOptions['primary'];
  }
}

export const appTheme = createTheme({
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 960,
      lg: 1240,
      xl: 1720,
    },
  },
  palette: {
    background: {
      default: grey[100],
    },
    common: {
      white: '#ffffff',
      black: '#000000',
    },
    primary: {
      light: '#5595D9',
      main: '#1E5189',
      dark: '#003366',
      contrastText: '#ffffff',
    },
    selected: {
      light: '#e3f2fd',
      main: '#e3f2fd',
      dark: '#bbdefb',
      contrastText: '#1E5189',
    },
    success: {
      light: '#7fc09bff',
      main: '#247827ff',
      dark: '#207030ff',
    },
    error: { light: '#e9898cff', main: '#d72f2fff', dark: '#8c0a0eff' },
    text: {
      primary: '#313132',
      secondary: 'rgb(112, 112, 112)',
    },
    action: {
      selected: grey[200],
      hover: grey[100],
    },
    divider: '#f2f2f2',
  },
  typography: {
    fontSize: 15,
    fontFamily: ['BCSans', 'Verdana', 'Arial', 'sans-serif'].join(','),
    h1: {
      fontSize: '1.5rem',
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
      fontSize: '0.8rem',
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
      styleOverrides: {
        root: {
          border: 'none',
          boxShadow: 'none',
          overflow: 'visible',
        },
        grouped: {
          border: 'none',
          boxShadow: 'none',
          position: 'relative',
          '&:not(:last-of-type)': {
            borderRight: 'none',
          },
          '&.Mui-focusVisible': {
            zIndex: 2,
          },
          '&:focus': {
            zIndex: 2,
          },
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true, disableRipple: true, disableFocusRipple: true },
      styleOverrides: {
        root: {
          fontWeight: 700,
          textTransform: 'capitalize',
          whiteSpace: 'nowrap',
          padding: '6px 12px',
          lineHeight: 1.4,
          '&:focus': {
            outline: '2px solid #3B99FC',
            outlineOffset: '-1px',
          },
          '&:active': {
            boxShadow: 'none',
            filter: 'brightness(0.9)',
          },
          '&:hover': {
            filter: 'brightness(0.95)',
          },
        },
        contained: {
          letterSpacing: '0.02rem',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        outlined: {
          borderWidth: 1,
          borderColor: 'inherit',
        },
        text: {
          fontSize: '0.8rem',
        },
        startIcon: {
          marginBottom: '1px',
          mr: 0,
          padding: '0 8px',
        },
        sizeSmall: {
          fontSize: '0.9rem',
          padding: '4px 10px',
        },
        sizeMedium: {
          fontSize: '0.875rem',
          padding: '10px 12px',
        },
        sizeLarge: {
          fontSize: '1rem',
          padding: '12px 14px',
        },
      },
    },
    MuiButtonBase: {
      defaultProps: {
        disableRipple: true,
      },
    },
    MuiList: {
      styleOverrides: {
        root: {
          paddingTop: 0,
          paddingBottom: 0,
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          border: 'none',
          borderRadius: '6px',
          paddingTop: 8,
          paddingBottom: 8,
          transition: 'background-color 0.15s ease',
          '&:hover': {
            backgroundColor: 'rgba(15, 23, 42, 0.06)',
          },
          '&.Mui-selected': {
            backgroundColor: grey[200],
          },
          '&.Mui-selected:hover': {
            backgroundColor: grey[300],
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: '4px',
          textTransform: 'capitalize',
          padding: '10px 5px !important',
          fontWeight: 700,
          boxShadow: 'none',
          '& .MuiTouchRipple-root': {
            display: 'none',
          },
          '&.MuiChip-clickable:hover': {
            filter: 'brightness(0.95)',
          },
          '&.MuiChip-clickable:active': {
            filter: 'brightness(0.9)',
            boxShadow: 'none',
          },
          '&.Mui-focusVisible': {
            filter: 'brightness(0.95)',
            boxShadow: 'none',
          },
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
          paddingTop: '8px !important',
        },
      },
    },
    MuiDialogContentText: {
      styleOverrides: {
        root: {
          marginBottom: '16px',
          color: 'rgb(112, 112, 112)',
          fontSize: '0.9rem',
          lineHeight: 1.5,
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
      defaultProps: {
        disableRipple: true,
        disableFocusRipple: true,
      },
      styleOverrides: {
        root: {
          boxShadow: 'none',
          borderRadius: '4px',
          '&:hover': {
            backgroundColor: grey[200],
          },
          '&:active': {
            boxShadow: 'none',
            backgroundColor: grey[300],
          },
          '&:focus': {
            outline: '3px solid #3B99FC',
            outlineOffset: '-3px',
          },
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: ({ theme }) => ({
          color: theme.palette.text.primary,
        }),
        input: ({ theme }) => ({
          color: theme.palette.text.primary,
          '&::placeholder': {
            color: theme.palette.text.secondary,
            opacity: 0.7,
          },
        }),
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: ({ theme }) => ({
          '& .MuiOutlinedInput-root': {
            borderRadius: '4px',
            padding: '8px 16px 8px 16px',
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            '&.Mui-disabled': {
              backgroundColor: disabledInputBackground,
            },
            '& .MuiInputAdornment-root': {
              padding: 0,
            },
            '& .MuiInputAdornment-positionStart': {
              marginLeft: 0,
              marginRight: '10px',
            },
            '& .MuiInputAdornment-positionEnd': {
              marginLeft: '10px',
              marginRight: 0,
            },
            '&.MuiInputBase-sizeSmall': {
              padding: '6px 12px',
            },
            '&.MuiInputBase-sizeSmall .MuiInputBase-input': {
              padding: '6px 0',
            },
            '&.MuiInputBase-sizeSmall .MuiInputAdornment-positionStart': {
              marginRight: '8px',
            },
            '&.MuiInputBase-sizeSmall .MuiInputAdornment-positionEnd': {
              marginLeft: '8px',
            },
            '& fieldset': {
              border: `1px solid ${grey[400]}`,
            },
            '&:hover fieldset': {
              borderColor: grey[600],
            },
            '&.Mui-focused fieldset': {
              borderColor: theme.palette.primary.main,
              borderWidth: '2px',
            },
            '&.Mui-error input::placeholder': {
              color: theme.palette.error.main,
              opacity: 1,
            },
          },
          '& .MuiInputBase-input': {
            padding: '8px 0',
            color: theme.palette.text.primary,
          },
          '& .MuiInputBase-input::placeholder': {
            color: theme.palette.text.secondary,
            opacity: 0.7,
          },
          '& .MuiInputAdornment-positionStart': {
            color: alpha(theme.palette.text.secondary, 0.78),
            '& .MuiSvgIcon-root, & svg': {
              color: 'inherit',
            },
          },
          '& .MuiFormLabel-root': {
            top: 1,
            left: 1,
          },
          '& .MuiOutlinedInput-root.Mui-error .MuiInputAdornment-positionStart': {
            color: theme.palette.error.main,
          },
          '& .MuiOutlinedInput-root.Mui-error .MuiInputAdornment-root': {
            color: theme.palette.error.main,
          },
        }),
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: theme.palette.background.paper,
          '&.Mui-disabled': {
            backgroundColor: disabledInputBackground,
          },
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: grey[400],
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: grey[600],
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: theme.palette.primary.main,
            borderWidth: '2px',
          },
        }),
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: ({ theme }) => ({
          color: theme.palette.text.secondary,
          '&.Mui-focused': {
            color: theme.palette.primary.main,
          },
          '&.Mui-error': {
            color: theme.palette.error.main,
          },
        }),
        outlined: {
          transform: 'translate(16px, 16px) scale(1)',
          '&.MuiInputLabel-shrink': {
            transform: 'translate(14px, -9px) scale(0.75)',
          },
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: ({ theme }) => ({
          color: theme.palette.text.secondary,
          '&.Mui-error': {
            color: theme.palette.error.main,
          },
        }),
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        root: ({ theme }) => ({
          '&.MuiAutocomplete-hasPopupIcon .MuiOutlinedInput-root, &.MuiAutocomplete-hasClearIcon .MuiOutlinedInput-root':
            {
              paddingRight: '18px',
            },
          '& .MuiOutlinedInput-root': {
            borderRadius: '4px',
            padding: '8px 16px 8px 16px',
            '&.Mui-disabled': {
              backgroundColor: disabledInputBackground,
            },
            '& .MuiAutocomplete-endAdornment': {
              paddingRight: '18px !important',
            },
            '& .MuiAutocomplete-popupIndicator, &.MuiAutocomplete-hasPopupIcon': {
              display: 'none',
            },
            '& .MuiFormLabel-root': {
              top: 1,
              left: 1,
            },
          },
          '& .MuiInputBase-input': {
            padding: '8px 0px !important',
          },
          '& .MuiAutocomplete-tag': {
            backgroundColor: alpha(theme.palette.primary.main, 0.14),
            color: theme.palette.primary.dark,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
            marginRight: '8px',
            '& .MuiChip-label': {
              color: theme.palette.primary.dark,
              fontWeight: 700,
            },
            '& .MuiChip-deleteIcon': {
              fontSize: '1rem',
              color: alpha(theme.palette.primary.dark, 0.85),
              '&:hover': {
                color: theme.palette.primary.dark,
              },
            },
          },
        }),
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
    MuiMenuItem: {
      defaultProps: { disableRipple: true, disableTouchRipple: true },
      styleOverrides: {
        root: {
          margin: 0,
          padding: '12px',
          borderRadius: '4px',
          '& .MuiTypography-root': {
            fontWeight: 700,
          },
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        root: {
          '& .MuiPaper-root': {
            borderRadius: '6px',
            padding: '8px',
          },
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
