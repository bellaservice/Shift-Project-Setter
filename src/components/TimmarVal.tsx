"use client";

import { useState } from "react";
import {
  Chevron,
  DropdownPanel,
  dropdownTrigger,
  useDropdown,
} from "@/components/Dropdown";
import { Wheel, WheelPlate } from "@/components/Wheel";

/**
 * Passets BETALDA timmar, valda pa ett hjul.
 *
 * Varfor det inte racker med Pass Tider
 * -------------------------------------
 * Spannet 07:00–16:00 ar nio timmar pa plats. Ar en av dem obetald rast ar
 * passet atta timmar vart. Appen kanner inte till raster och kan alltsa inte
 * rakna fram svaret — darfor har den alltid haft TVA tal om ett pass: spannet
 * man var dar, och timmarna som betalas. Det ar samma skillnad som star pa
 * `shifts.hours` sedan den forsta migrationen.
 *
 * Halvtimmar och inte bara hela: 7,5 ar det vanligaste passet i appens egna
 * exempel, och ett hjul som bara kan 7 eller 8 tvingar fram ett fel.
 *
 * Hjul och inte sifferfalt: samma gest som Pass Tider bredvid, och ingen
 * mojlighet att skriva "8h" eller "atta" i ett falt som vantar sig ett tal.
 * Byggt av samma delar som TimeRangeSelect — en dold <select> som bar vardet at
 * formularet, en trigger, och panelen med hjulet i.
 */

/** 0 till 24 i halvtimmessteg, med svenskt decimalkomma. */
const TIMMAR = Array.from({ length: 49 }, (_, i) => {
  const t = i / 2;
  return Number.isInteger(t) ? String(t) : String(t).replace(".", ",");
});

/** Utgangslaget. Atta timmar ar en arbetsdag; nagot maste hjulet sta pa. */
const STANDARD = "8";

export function TimmarVal({
  name,
  label,
  value,
  onChange,
}: {
  name: string;
  label: string;
  /** '' innan nagot valts — faltet skickas da tomt och tolkas som "inget". */
  value: string;
  onChange: (value: string) => void;
}) {
  const dd = useDropdown<"timmar">();
  // Hjulet oppnar pa det valda vardet, annars pa atta. Las en gang: darefter ar
  // det hjulets egen rullning som bar vardet.
  const [utgang] = useState(() => (value === "" ? STANDARD : value));

  return (
    <div className="relative" onKeyDown={dd.onRootKeyDown}>
      {/* Den dolda <select>:en ar den som faktiskt heter `name` och hamnar i
          formData. Samma grepp som i TimeRangeSelect: knappen ar utseendet,
          select:en ar vardet. */}
      <select
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-hidden="true"
        tabIndex={-1}
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
      >
        <option value="" />
        {value !== "" && <option value={value}>{value}</option>}
      </select>

      <button
        ref={dd.registerTrigger("timmar")}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={dd.open === "timmar"}
        aria-label={label}
        onClick={() => dd.toggle("timmar")}
        {...dropdownTrigger(dd.open === "timmar", value !== "", "w-full")}
      >
        <span className="truncate tabular-nums">
          {value === "" ? "Valj timmar" : `${value} h`}
        </span>
        <Chevron open={dd.open === "timmar"} />
      </button>

      {dd.open === "timmar" && (
        <DropdownPanel
          label={label}
          columns={1}
          panelRef={dd.panelRef}
          /* `group` och inte `listbox`: hjulet ar sjalv en listbox, och en
             listbox far inte innehalla en annan. Samma undantag som tidshjulet
             gor. */
          role="group"
        >
          <div className="relative px-3 py-2">
            <WheelPlate />
            <div className="relative mx-auto flex max-w-40 items-center">
              <Wheel
                label={label}
                values={TIMMAR}
                initialValue={utgang}
                autoFocus
                onChange={onChange}
              />
              <span aria-hidden className="pl-2 text-lg font-bold text-white/40">
                h
              </span>
            </div>
          </div>
        </DropdownPanel>
      )}
    </div>
  );
}
