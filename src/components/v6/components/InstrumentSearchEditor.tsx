import {
  useState,
  useMemo,
  useRef,
  forwardRef,
  useImperativeHandle,
  useEffect,
} from "react";
import { Autocomplete } from "@mantine/core";
import type { ICellEditorParams } from "ag-grid-community";
import type { BondInstrument } from "../../../types/index.ts";

export interface InstrumentSearchEditorProps extends ICellEditorParams {
  instruments: BondInstrument[];
  onSelectInstrument?: (
    rowId: string | undefined,
    instrument: BondInstrument,
  ) => void;
}

export const InstrumentSearchEditor = forwardRef<
  unknown,
  InstrumentSearchEditorProps
>((props, ref) => {
  const initialValue = typeof props.value === "string" ? props.value : "";
  const [value, setValue] = useState(initialValue);
  const selectedValueRef = useRef<string>("");
  const committedValueRef = useRef<string>(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    getValue: () => {
      return (
        committedValueRef.current ||
        selectedValueRef.current ||
        props.node?.data?.isin ||
        initialValue
      );
    },
    isCancelAfterEnd: () => false,
    isPopup: () => true,
    getPopupPosition: () => "under" as const,
  }));

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const instrumentList = props.instruments || [];

  const displayData = useMemo(
    () => instrumentList.map((i) => `${i.isin} - ${i.description}`),
    [instrumentList],
  );

  const displayToInstrument = useMemo(() => {
    const map = new Map<string, BondInstrument>();
    for (const instrument of instrumentList) {
      map.set(`${instrument.isin} - ${instrument.description}`, instrument);
    }
    return map;
  }, [instrumentList]);

  const handleSelect = (instrument: BondInstrument, displayValue: string) => {
    selectedValueRef.current = instrument.isin;
    committedValueRef.current = instrument.isin;
    setValue(displayValue);

    if (props.node) {
      props.node.setDataValue("isin", instrument.isin);
      props.node.setDataValue("description", instrument.description);
      props.node.setDataValue("maturity", instrument.maturity);
      props.node.setDataValue("issuer", instrument.issuer);
    }

    props.onSelectInstrument?.(props.node?.data?.id, instrument);

    // Stop editing after selection
    setTimeout(() => props.api.stopEditing(), 0);
  };

  return (
    <div style={{ width: 420 }}>
      <Autocomplete
        ref={inputRef}
        value={value}
        data={displayData}
        placeholder="Select Bond..."
        limit={30}
        maxDropdownHeight={250}
        comboboxProps={{ withinPortal: false }}
        onChange={(nextValue) => {
          const maybeInstrument = displayToInstrument.get(nextValue);
          selectedValueRef.current = maybeInstrument
            ? maybeInstrument.isin
            : "";
          setValue(nextValue);
        }}
        onOptionSubmit={(optionValue) => {
          const instrument = displayToInstrument.get(optionValue);
          if (!instrument) return;
          handleSelect(instrument, optionValue);
        }}
      />
    </div>
  );
});

InstrumentSearchEditor.displayName = "InstrumentSearchEditor";
