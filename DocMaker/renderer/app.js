(function () {
  const daysContainer = document.getElementById('daysContainer');
  const dayTemplate = document.getElementById('dayTemplate');
  const rowTemplate = document.getElementById('rowTemplate');
  const newDayBtn = document.getElementById('newDayBtn');
  const generateBtn = document.getElementById('generateBtn');
  const clearBtn = document.getElementById('clearBtn');
  const openDraftBtn = document.getElementById('openDraftBtn');

  const toast = document.getElementById('toast');
  const toastText = document.getElementById('toastText');
  const toastOpen = document.getElementById('toastOpen');
  const toastFolder = document.getElementById('toastFolder');
  const toastClose = document.getElementById('toastClose');

  let lastGeneratedPath = null;

  // The browser may finish (and fail) loading an image before this script
  // runs, since it sits at the end of <body> — so check the already-settled
  // state in addition to listening for a future error.
  function wireLogoFallback(imgEl, fallbackEl, fallbackDisplay) {
    function handleFailure() {
      imgEl.style.display = 'none';
      fallbackEl.style.display = fallbackDisplay;
    }
    if (imgEl.complete) {
      if (imgEl.naturalWidth === 0) handleFailure();
    } else {
      imgEl.addEventListener('error', handleFailure);
    }
  }
  wireLogoFallback(document.getElementById('logoImg'), document.getElementById('logoFallback'), 'flex');
  wireLogoFallback(document.getElementById('brandLogoImg'), document.getElementById('brandLogoFallback'), 'block');

  function addRow(rowsList, values, { focus = true } = {}) {
    const node = rowTemplate.content.firstElementChild.cloneNode(true);
    if (values) {
      ['arbetare', 'passTyp1', 'passTyp2', 'project'].forEach((field) => {
        const input = node.querySelector(`[data-field="${field}"]`);
        if (input && values[field]) input.value = values[field];
      });
    }
    rowsList.appendChild(node);
    if (focus) node.querySelector('input')?.focus();
  }

  function addDay(prefillDate, rows, { focus = true } = {}) {
    const node = dayTemplate.content.firstElementChild.cloneNode(true);
    const dateInput = node.querySelector('.date-input');
    if (prefillDate) dateInput.value = prefillDate;

    const rowsList = node.querySelector('.rows-list');
    daysContainer.appendChild(node);

    if (rows && rows.length) {
      rows.forEach((row) => addRow(rowsList, row, { focus: false }));
    } else {
      addRow(rowsList, null, { focus });
    }
    if (focus) dateInput.focus();
  }

  daysContainer.addEventListener('click', (e) => {
    if (e.target.closest('.new-row')) {
      const dayBlock = e.target.closest('.day-block');
      addRow(dayBlock.querySelector('.rows-list'));
    } else if (e.target.closest('.remove-row')) {
      const row = e.target.closest('.row');
      const rowsList = row.parentElement;
      if (rowsList.children.length > 1) {
        row.remove();
      }
    } else if (e.target.closest('.remove-day')) {
      if (daysContainer.children.length > 1) {
        e.target.closest('.day-block').remove();
      }
    } else {
      return;
    }
    updatePreview();
  });

  newDayBtn.addEventListener('click', () => {
    addDay();
    updatePreview();
  });

  clearBtn.addEventListener('click', () => {
    if (!confirm('Rensa hela formuläret? Alla ifyllda uppgifter försvinner.')) return;
    daysContainer.innerHTML = '';
    addDay(defaultDateString());
    updatePreview();
  });

  openDraftBtn.addEventListener('click', async () => {
    if (!confirm('Öppna ett utkast? Det ersätter det du har fyllt i just nu.')) return;

    openDraftBtn.disabled = true;
    try {
      const result = await window.docmaker.openDraft();
      if (result.cancelled) return;
      if (result.error) {
        showToast(result.error);
        return;
      }

      populateCoverData(result.cover || {});

      daysContainer.innerHTML = '';
      if (result.days && result.days.length) {
        result.days.forEach((day) => addDay(day.date, day.rows, { focus: false }));
      } else {
        addDay(defaultDateString());
      }

      updatePreview();
      showToast('Utkast öppnat.');
    } catch (err) {
      showToast('Kunde inte öppna utkastet.');
      console.error(err);
    } finally {
      openDraftBtn.disabled = false;
    }
  });

  function defaultDateString() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function collectData() {
    const days = [];
    daysContainer.querySelectorAll('.day-block').forEach((dayBlock) => {
      const date = dayBlock.querySelector('.date-input').value.trim();
      const rows = [];
      dayBlock.querySelectorAll('.rows-list .row').forEach((row) => {
        const get = (field) => row.querySelector(`[data-field="${field}"]`).value.trim();
        const arbetare = get('arbetare');
        const passTyp1 = get('passTyp1');
        const passTyp2 = get('passTyp2');
        const project = get('project');
        if (arbetare || passTyp1 || passTyp2 || project) {
          rows.push({ arbetare, passTyp1, passTyp2, project });
        }
      });
      if (date || rows.length) {
        days.push({ date, rows });
      }
    });
    return days;
  }

  function suggestFileName(days) {
    const firstDate = days.find((d) => d.date)?.date;
    return firstDate ? `Arbetsdagbok_${firstDate}` : 'Arbetsdagbok';
  }

  const coverSection = document.getElementById('coverSection');

  function collectCoverData() {
    return {
      adressChecked: document.getElementById('chkAdress').checked,
      adress: document.getElementById('valAdress').value.trim(),
      bolagChecked: document.getElementById('chkBolag').checked,
      bolag: document.getElementById('valBolag').value.trim(),
      orgnrChecked: document.getElementById('chkOrgnr').checked,
      orgnr: document.getElementById('valOrgnr').value.trim(),
      project: document.getElementById('valProject').value.trim()
    };
  }

  function populateCoverData(cover) {
    document.getElementById('chkAdress').checked = cover.adressChecked !== false;
    document.getElementById('valAdress').value = cover.adress || '';
    document.getElementById('chkBolag').checked = cover.bolagChecked !== false;
    document.getElementById('valBolag').value = cover.bolag || '';
    document.getElementById('chkOrgnr').checked = cover.orgnrChecked !== false;
    document.getElementById('valOrgnr').value = cover.orgnr || '';
    document.getElementById('valProject').value = cover.project || '';
  }

  const previewFrame = document.getElementById('previewFrame');
  const previewEmpty = document.getElementById('previewEmpty');

  function debounce(fn, delayMs) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delayMs);
    };
  }

  // Guards against a slower, older preview render resolving after a newer
  // one and clobbering it on screen.
  let previewRequestId = 0;

  async function updatePreview() {
    const days = collectData();
    if (!days.length) {
      previewFrame.hidden = true;
      previewEmpty.hidden = false;
      return;
    }
    const requestId = ++previewRequestId;
    try {
      const base64Pdf = await window.docmaker.previewPdf({ days, cover: collectCoverData() });
      if (requestId !== previewRequestId) return;
      previewFrame.src = `data:application/pdf;base64,${base64Pdf}`;
      previewFrame.hidden = false;
      previewEmpty.hidden = true;
    } catch (err) {
      console.error('Kunde inte uppdatera förhandsgranskningen', err);
    }
  }

  const debouncedUpdatePreview = debounce(updatePreview, 350);
  daysContainer.addEventListener('input', debouncedUpdatePreview);
  coverSection.addEventListener('input', debouncedUpdatePreview);
  coverSection.addEventListener('change', updatePreview);

  function showToast(message, { withActions } = {}) {
    toastText.textContent = message;
    toastOpen.hidden = !withActions;
    toastFolder.hidden = !withActions;
    toast.hidden = false;
  }

  function hideToast() {
    toast.hidden = true;
  }

  toastClose.addEventListener('click', hideToast);
  toastOpen.addEventListener('click', () => {
    if (lastGeneratedPath) window.docmaker.openFile(lastGeneratedPath);
  });
  toastFolder.addEventListener('click', () => {
    if (lastGeneratedPath) window.docmaker.showInFolder(lastGeneratedPath);
  });

  generateBtn.addEventListener('click', async () => {
    const days = collectData();
    if (!days.length) {
      showToast('Fyll i minst en rad innan du genererar dokumentet.');
      return;
    }

    generateBtn.disabled = true;
    generateBtn.textContent = 'Genererar…';

    try {
      const result = await window.docmaker.generatePdf({
        days,
        cover: collectCoverData(),
        suggestedFileName: suggestFileName(days)
      });

      if (result.cancelled) {
        // user closed the save dialog without choosing a location
      } else {
        lastGeneratedPath = result.filePath;
        showToast(`PDF sparad. Ett utkast sparades också bredvid den – öppna det senare med "Öppna utkast".`, { withActions: true });
      }
    } catch (err) {
      showToast('Något gick fel när dokumentet skulle skapas.');
      console.error(err);
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = 'Generera Document';
    }
  });

  async function loadFooter() {
    try {
      const c = await window.docmaker.loadCompanyInfo();
      document.getElementById('fPostadressLabel').textContent = c.postadressLabel;
      document.getElementById('fAddress').innerHTML = (c.postadress || []).join('<br>');
      document.getElementById('fPhoneLine').textContent = `${c.telefonLabel}: ${c.telefon}`;
      document.getElementById('fBankgiroLine').textContent = `${c.bankgiroLabel}: ${c.bankgiro}`;
      document.getElementById('fOrgnote').textContent = c.orgnote;
      document.getElementById('fOrgnrLine').textContent = `${c.orgnrLabel}: ${c.orgnr}`;
      document.getElementById('fMomsregLine').textContent = `${c.momsregLabel}: ${c.momsregnr}`;
    } catch (err) {
      console.error('Kunde inte läsa företagsuppgifter', err);
    }
  }

  loadFooter();
  addDay(defaultDateString());
  updatePreview();
})();
