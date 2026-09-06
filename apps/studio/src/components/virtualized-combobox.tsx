import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";

import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Option = {
  value: string;
  label: string;
};

interface VirtualizedCommandProps {
  height: string;
  options: Option[];
  placeholder: string;
  selectedOption: string;
  onSelectOption?: (option: string) => void;
}

const VirtualizedCommand = ({
  height,
  options,
  placeholder,
  selectedOption,
  onSelectOption,
}: VirtualizedCommandProps) => {
  const [search, setSearch] = React.useState("");
  const [focusedIndex, setFocusedIndex] = React.useState(0);
  const [isKeyboardNavActive, setIsKeyboardNavActive] = React.useState(false);

  const parentRef = React.useRef<HTMLDivElement>(null);

  const filteredOptions = React.useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(
      (option) => option.value.toLowerCase().includes(q) || option.label.toLowerCase().includes(q),
    );
  }, [options, search]);

  const virtualizer = useVirtualizer({
    count: filteredOptions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 5,
  });

  const virtualOptions = virtualizer.getVirtualItems();

  const scrollToIndex = (index: number) => {
    virtualizer.scrollToIndex(index, {
      align: "auto",
    });
  };

  const handleSearch = (val: string) => {
    setIsKeyboardNavActive(false);
    setSearch(val);
    setFocusedIndex(0);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        setIsKeyboardNavActive(true);
        setFocusedIndex((prev) => {
          const newIndex = prev === -1 ? 0 : Math.min(prev + 1, filteredOptions.length - 1);
          scrollToIndex(newIndex);
          return newIndex;
        });
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        setIsKeyboardNavActive(true);
        setFocusedIndex((prev) => {
          const newIndex = prev === -1 ? filteredOptions.length - 1 : Math.max(prev - 1, 0);
          scrollToIndex(newIndex);
          return newIndex;
        });
        break;
      }
      case "Enter": {
        event.preventDefault();
        if (filteredOptions[focusedIndex]) {
          onSelectOption?.(filteredOptions[focusedIndex].value);
        }
        break;
      }
      default:
        break;
    }
  };

  React.useEffect(() => {
    if (selectedOption) {
      const option = filteredOptions.find((option) => option.value === selectedOption);
      if (option) {
        const index = filteredOptions.indexOf(option);
        setFocusedIndex(index);
        virtualizer.scrollToIndex(index, {
          align: "auto",
        });
      }
    }
  }, [selectedOption, filteredOptions, virtualizer]);

  return (
    <Command shouldFilter={false} onKeyDown={handleKeyDown} className="w-full">
      <CommandInput onValueChange={handleSearch} placeholder={placeholder} className="h-9" />
      <CommandList
        ref={parentRef}
        style={{
          height: height,
          width: "100%",
          overflow: "auto",
        }}
        className="p-1"
        onMouseDown={() => setIsKeyboardNavActive(false)}
        onMouseMove={() => setIsKeyboardNavActive(false)}
      >
        <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">
          No font found.
        </CommandEmpty>
        <CommandGroup className="p-0">
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualOptions.map((virtualOption) => {
              const item = filteredOptions[virtualOption.index];
              if (!item) return null;
              const isSelected = selectedOption === item.value;

              return (
                <CommandItem
                  key={item.value}
                  disabled={isKeyboardNavActive}
                  className={cn(
                    "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none transition-colors",
                    focusedIndex === virtualOption.index && "bg-accent text-accent-foreground",
                    isKeyboardNavActive &&
                      focusedIndex !== virtualOption.index &&
                      "aria-selected:bg-transparent aria-selected:text-primary",
                  )}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualOption.size}px`,
                    transform: `translateY(${virtualOption.start}px)`,
                  }}
                  value={item.value}
                  onMouseEnter={() => !isKeyboardNavActive && setFocusedIndex(virtualOption.index)}
                  onMouseLeave={() => !isKeyboardNavActive && setFocusedIndex(-1)}
                  onSelect={() => onSelectOption?.(item.value)}
                >
                  <span className="flex-1 truncate">{item.label}</span>
                  {isSelected && (
                    <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                      <Check className="h-4 w-4 text-foreground" />
                    </span>
                  )}
                </CommandItem>
              );
            })}
          </div>
        </CommandGroup>
      </CommandList>
    </Command>
  );
};

export interface VirtualizedComboboxProps {
  options: string[];
  selectedOption?: string;
  onSelectOption?: (option: string) => void;
  searchPlaceholder?: string;
  width?: string;
  height?: string;
  className?: string;
}

export function VirtualizedCombobox({
  options,
  selectedOption: controlledSelectedOption,
  onSelectOption,
  searchPlaceholder = "Search items...",
  height = "280px",
  className,
}: VirtualizedComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [internalSelectedOption, setInternalSelectedOption] = React.useState("");

  const currentSelected =
    controlledSelectedOption !== undefined ? controlledSelectedOption : internalSelectedOption;

  const handleSelect = (val: string) => {
    if (controlledSelectedOption === undefined) {
      setInternalSelectedOption(val);
    }
    onSelectOption?.(val);
    setOpen(false);
  };

  const optionObjects = React.useMemo(
    () => options.map((option) => ({ value: option, label: option })),
    [options],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 hover:bg-accent/10 transition-colors text-left",
            className,
          )}
        >
          <span className="truncate">
            {currentSelected
              ? options.find((option) => option === currentSelected) || currentSelected
              : searchPlaceholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 border border-border bg-popover text-popover-foreground shadow-md rounded-md overflow-hidden"
        style={{ width: "var(--radix-popover-trigger-width)" }}
        align="start"
      >
        <VirtualizedCommand
          height={height}
          options={optionObjects}
          placeholder={searchPlaceholder}
          selectedOption={currentSelected}
          onSelectOption={handleSelect}
        />
      </PopoverContent>
    </Popover>
  );
}
