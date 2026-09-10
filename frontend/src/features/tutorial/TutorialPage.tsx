import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import { MarkdownContent } from 'components/markdown/MarkdownContent';
import { useConservationApi } from 'hooks/useConservationApi';
import useDataLoader from 'hooks/useDataLoader';
import { useEffect } from 'react';

/**
 * Authenticated tutorial page backed by application-managed Markdown.
 *
 * @returns {JSX.Element} Tutorial page content.
 */
export const TutorialPage = () => {
  const conservationApi = useConservationApi();
  const markdownLoader = useDataLoader(conservationApi.markdown.getMarkdown);
  const hasError = Boolean(markdownLoader.error);

  useEffect(() => {
    void markdownLoader.load('tutorial');
  }, [markdownLoader]);

  return (
    <Box height="100%" overflow="auto" sx={{ backgroundColor: 'background.default' }}>
      <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
        {markdownLoader.isLoading && (
          <Box display="flex" justifyContent="center" py={8}>
            <CircularProgress aria-label="Loading tutorial" />
          </Box>
        )}

        {!markdownLoader.isLoading && hasError && (
          <Alert severity="error">Unable to load the tutorial. Please try again.</Alert>
        )}

        {!markdownLoader.isLoading && !hasError && markdownLoader.data && (
          <MarkdownContent markdown={markdownLoader.data.data} />
        )}
      </Container>
    </Box>
  );
};
