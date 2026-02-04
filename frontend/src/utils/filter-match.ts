import { TaskLayerOption } from 'features/home/task/create/form/layer/task-layer.interface';

export function doesLayerMatchFilters(layer: TaskLayerOption, inputValue: string, groupFilters: string[]): boolean {
  const search = inputValue.trim().toLowerCase();

  if (groupFilters.length === 0) {
    return search === '' || layer.name.toLowerCase().includes(search);
  }

  const segments = layer.group.toLowerCase().split('/');
  const matchesGroupFilter = groupFilters.some((filter) => segments.includes(filter));
  const matchesSearch = search === '' || layer.name.toLowerCase().includes(search);

  return matchesGroupFilter && matchesSearch;
}

export function createInputValueAndDetectFiltersHandler(
  availableLayers: TaskLayerOption[],
  setInputValue: (val: string) => void,
  setGroupFilters: React.Dispatch<React.SetStateAction<string[]>>
) {
  return (input: string) => {
    if (/[a-zA-Z]\s*:/i.test(input)) {
      const filterPrefix = input.split(':')[0].toLowerCase().trim();

      const knownSegments = Array.from(
        new Set(availableLayers.flatMap((layer) => layer.group.toLowerCase().split('/')))
      );

      const matchedSegments = knownSegments.filter((segment) => segment.startsWith(filterPrefix));

      if (matchedSegments.length > 0) {
        setGroupFilters((prev) => {
          const newFilters = [...prev];
          matchedSegments.forEach((segment) => {
            if (!newFilters.includes(segment)) {
              newFilters.push(segment);
            }
          });
          return newFilters;
        });

        // Clear input only if filters are added
        return setInputValue('');
      }
    }

    // Otherwise just update input value normally
    setInputValue(input);
  };
}
