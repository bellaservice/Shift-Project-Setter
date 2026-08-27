# Handbok för arbetsledare

Den här handboken beskriver appen så som den fungerar i dag, 2026-08-27.
Funktioner som är beslutade men ännu inte byggda står under
[Det som inte finns än](#det-som-inte-finns-än) längst ner — så att du vet vad du
kan lita på och vad du inte ska leta efter.

**Skärmarnas namn skrivs utan å, ä och ö** i appen ("Bekrafta Pass", "Stampla").
Det är avsiktligt och inte ett stavfel. I den här texten står knapparnas namn
precis som de står på skärmen, medan brödtexten är på vanlig svenska.

---

## 1. Vad du kan göra, och vad arbetarna kan

Appen känner två roller. Din inloggning avgör vilken meny du får — du behöver
inte välja något.

| | Arbetsledare | Arbetare |
|---|---|---|
| Se schema och pass | ✅ | ✅ |
| Bekräfta pass och sätta timmar | ✅ | ❌ |
| Justera stämplade tider | ✅ | ❌ |
| Stämpla in och ut | ❌ (inget eget pass) | ✅ (bara sina egna) |
| Se hela arbetarregistret | ✅ | ❌ (bara sig själv) |
| Skapa och ändra konton | ✅ | ❌ |

Spärrarna sitter i databasen, inte i skärmbilden. En arbetare som skriver in
adressen till din bekräftelseskärm möts av ett besked, och skulle hen ta sig
förbi det skulle databasen ändå vägra. **Du kan alltså inte råka ge bort en
befogenhet genom att visa någon din skärm.**

---

## 2. Bekrafta Pass — din huvudskärm

Meny → **Bekrafta Pass**.

Hit kommer varje pass som är klart men inte avslutat. Ett pass dyker upp när

- arbetaren har stämplat ut, eller
- passets dag har passerat, även om ingen stämplat ut.

**Äldsta dagen ligger överst.** Det går inte att sortera om, och det är med
flit: i en lista som går att kasta om kan det äldsta ärendet gömma sig.

### Så läser du en rad

```
Goran Muftic
PL-1245 LANDSKRONA
┌────────────────────────────────┐
│ Stamplat 07:16–15:16           │  ← vad arbetaren faktiskt stämplade
│ Klockan sager 8 h              │  ← timmarna som klockan ger
└────────────────────────────────┘
☐ Sen — lat mig justera tiderna
Timmar [ 8 ]           [ Bekrafta ]
[ Kom inte — bekrafta 0 timmar ]
```

**"Klockan sager" är underlag, inte lön.** Det är spannet mellan in- och
utstämpling, rakt av. Obetald rast dras inte bort, eftersom appen inte känner
till några raster. Det är därför du fyller i timmarna själv.

Rutan **Timmar** är förifylld med klockans siffra som ett förslag. Ändra den
när passet innehöll obetald rast, eller när ni kommit överens om något annat.
Det du skriver här är det som betalas ut och det som hamnar i Arbetsdagboken.

### Passet saknar utstämpling

Står det **Ej utstamplad** har arbetaren stämplat in men aldrig ut — oftast för
att telefonen låg i fickan när dagen tog slut. Då finns ingen "Klockan sager"
att luta sig mot. Fyll i timmarna efter vad ni kommer överens om och bekräfta.

Ett pass utan någon stämpling alls säger det rent ut: *"Passet har ingen
stampling."* Det är ett pass som lagts in via Logga Timmar, eller ett
schemalagt pass som ingen påbörjade.

### Justera en tid

Kryssa i **Sen** för att låsa upp plus och minus. Varje tryck flyttar tiden en
kvart.

**Arbetarens ursprungliga stämpling försvinner aldrig.** Så fort du ändrat en
tid står den kvar under fältet:

> *Arbetaren stamplade 08:16. Originalet sparas.*

Databasen sparar dessutom vem som gjorde ändringen och när. Det är själva
poängen med att du får ändra: Arbetsdagboken rapporterar din siffra, men
arbetarens egen stämpling går alltid att hitta tillbaka till.

### Bekrafta

Passet lämnar kön och går inte att ändra igen. **Bekräftelsen är slutgiltig** —
det finns ingen ångra-knapp, varken på skärmen eller i databasen.

Timmar måste vara ifyllt. Databasen vägrar bekräfta ett pass utan timtal, så
det finns ingen väg runt det.

Har en kollega hunnit före dig får du beskedet *"Passet ar redan bekraftat"* i
stället för att skriva över hens siffra. Ladda om sidan så ser du den aktuella
kön.

### Kom inte

Röda knappen bekräftar passet till **0 timmar**. Använd den när arbetaren
uteblev.

Raden raderas inte, och det är avsiktligt: passet var schemalagt, och att
ingen kom är en uppgift om dagen. En raderad rad hade i stället påstått att
passet aldrig fanns.

---

## 3. Skapa Pass — lägg ut pass i förväg

Meny → **Skapa Pass**.

Det här är skärmen som gör stämplingen användbar. Utan den finns det ingenting
för arbetarna att stämpla in på.

Du fyller i tre saker:

| Fält | |
|---|---|
| **Pass Datum** | dagen passet ska gå |
| **Project** | vilket project det hör till |
| **Arbetare** | vilka som ska gå passet — tryck **+ Lägg Till** för fler |

**Pass Tider är frivilliga.** Fyller du i dem säger de när passet ska börja och
sluta, och de skrivs ut som Pass Tider i Arbetsdagboken. Arbetaren stämplar
ändå sina egna tider — de planerade är ett besked om när man ska vara på plats,
inte en registrering av när man var det.

⚠️ **Det finns inget timfält här, och det är med flit.** Ett pass som ska hända
har inga arbetade timmar än. Timmarna sätter du när passet är över, i
**Bekrafta Pass**.

När du tryckt **Skapa Pass** ligger passen hos arbetarna under **Stampla**
direkt. Formuläret står kvar så att du kan lägga ut nästa dag utan att börja om.

### Om du lägger ut samma pass två gånger

Appen säger ifrån:

> *Temparbetare Testsson har redan ett pass på det här projectet den dagen.*

Det är ett skydd mot dubbeltryck och mot ett andra försök när nätet hackat —
arbetaren ska inte mötas av två likadana rader att stämpla in på. Behöver någon
verkligen två pass samma dag på samma project får det andra läggas in via
**Logga Timmar** i efterhand.

Redan **bekräftade** pass räknas inte som dubbletter. Att någon jobbat på ett
project en dag hindrar inte att hen jobbar där igen.

---

## 4. Logga Timmar — pass i efterhand

Startsidan → **Logga Timmar**.

Så här har appen alltid fungerat, och den vägen finns kvar oförändrad. Du väljer
project, dag, arbetare och timmar, och passet skrivs direkt som färdigt och
bekräftat. Det hamnar aldrig i bekräftelsekön.

Använd den när arbetet redan är gjort och ingen stämplat — en helg som ska in i
efterhand, eller ett pass någon rapporterat per telefon.

---

## 5. Arbetsdagboken

Meny → **Alla Project** → välj project → **Arbetsdagbok**.

Dokumentet är det juridiska underlaget för arbetad tid.

**Det går inte att skapa förrän varje pass på projectet är bekräftat.** Finns
obekräftade pass möts du av

> *"3 pass ar inte bekraftade an."*

och det finns ingen väg förbi. Andra frågor dokumentet ställer — ett
organisationsnummer ingen minns, en Pass Tid som saknas — går att hoppa över,
men den här gör det inte. Skälet är att ett pass som skrivs ut med "0" i en
juridisk handling läses som *"arbetaren var här och gjorde ingenting"*, vilket
är ett helt annat påstående än *"det här är inte klart än"*.

Bekräfta passen i kön, så öppnar sig dokumentet av sig självt.

---

## 6. Konton och roller

Meny (kugghjulet) → **Installningar** → **Konto**.

En arbetare behöver ett konto för att kunna stämpla. Kontot kräver en
e-postadress — adressen *är* inloggningen.

⚠️ **Nya konton blir arbetare.** Det är med flit: en inloggning ska aldrig födas
med fler befogenheter än den behöver. Ska någon vara arbetsledare måste rollen
sättas medvetet.

⚠️ **Rollen går i dag inte att ändra i appen.** Kolumnen finns i databasen men
har ingen knapp än. Behöver du befordra någon får det göras direkt i databasen
tills den skärmen finns — se [Det som inte finns än](#det-som-inte-finns-än).

Ett konto utan arbetare — kontoret, ekonomin — fungerar utmärkt. Det har bara
inga egna pass att stämpla på, och **Stampla** säger det rakt ut i stället för
att visa en tom lista.

---

## 7. Vanliga frågor

**Kan en arbetare sätta sina egna timmar?**
Nej. Databasen avvisar det med *"Bara en arbetsledare far andra timmarna pa ett
pass"*, oavsett hur försöket görs.

**Kan en arbetare stämpla på någon annans pass?**
Nej. Hen ser bara sina egna pass, och databasen accepterar inga andra.

**Vad händer om någon stämplar in men glömmer stämpla ut?**
Passet ligger kvar som pågående tills dagen passerat, och dyker sedan upp i din
kö märkt **Ej utstamplad**. Ingenting går förlorat.

**Kan jag ändra ett pass efter att jag bekräftat det?**
Nej. Bekräftelsen är slutgiltig.

**En arbetare säger sig inte se sina pass. Varför?**
Tre saker att gå igenom, i tur och ordning: är passet skapat under **Skapa
Pass**? Står rätt arbetare på det? Och ligger det på idag eller igår —
stämplingsskärmen visar inget annat. Är passet äldre än så ligger det i din kö
i stället.

---

## Det som inte finns än

Så att du inte letar efter något som inte är byggt:

| Saknas | Följd för dig |
|---|---|
| **Arbetarnas bekräfta/neka av tilldelade pass** (spec Fas 2) | Ingen accept/neka-funktion finns. |
| **Fastanställd, förval av dagar, "kan inte jobba", Priolista** (spec Avsnitt 4) | Ingen automatisk tillsättning av pass. |
| **Knapp för att byta roll på ett konto** | Roller sätts i databasen. |
| **"Sen" påverkar Priolistan** | Kryssrutan låser upp tidsjusteringen, men någon Priolista att flytta någon i finns inte än. |
