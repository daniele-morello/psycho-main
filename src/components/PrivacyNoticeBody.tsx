// Testo dell'informativa mostrato nel popup del sito. Lo stesso testo è in
// public/informativa-privacy.html: le due copie vanno tenute uguali.

const H3 = "font-cormorant text-2xl text-sage-700";
const H4 = "font-medium text-stone-800";
const LINK = "text-sage-700 underline underline-offset-2";

export default function PrivacyNoticeBody() {
  return (
    <article className="space-y-6 text-sm text-stone-700 leading-relaxed">
      <p>
        Questa informativa descrive i trattamenti di questo sito, secondo gli
        articoli 12, 13 e 9 del Regolamento (UE) 2016/679: il modulo «Chiedo
        informazioni», il modulo «Prenoto il primo colloquio» e la gestione degli
        appuntamenti che ne derivano. È una bozza: i punti segnati come da
        completare non sono verificati nel progetto e vanno inseriti prima di
        considerarla definitiva.
      </p>

      <section className="space-y-2">
        <h3 className={H3}>1. Identità e contatti del titolare</h3>
        <p>Titolare del trattamento: Dr.ssa Jerarda Damaris Ceglia.</p>
        <p>
          Contatto presente nel sito e usato per gli avvisi e le risposte:{" "}
          <a className={LINK} href="mailto:jerardadamarisceglia@gmail.com">
            jerardadamarisceglia@gmail.com
          </a>
          .
        </p>
        <p>
          Nel sito compaiono anche l’indirizzo «Via dei Colli 18, Padova», il
          telefono «+39 340 123 4567» e la dicitura «Psicologa iscritta all’Albo
          dell’Ordine di Padova · n. 4521». Questi elementi non risultano
          verificati nel progetto. Da completare prima della pubblicazione:
          confermare o correggere sede, telefono e iscrizione all’Albo. Non
          risultano partita IVA, codice fiscale, PEC né un responsabile della
          protezione dei dati.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className={H3}>2. Tipologie di dati raccolti</h3>
        <h4 className={H4}>Modulo «Chiedo informazioni»</h4>
        <p>Se la richiesta viene accettata, nel database vengono salvati:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>nome e cognome;</li>
          <li>indirizzo email;</li>
          <li>telefono, se inserito;</li>
          <li>
            servizio scelto tra Psicoterapia individuale, Terapia di coppia,
            Psicologia clinica e Altro;
          </li>
          <li>modalità preferita: Online / In presenza;</li>
          <li>orario preferito, se inserito;</li>
          <li>testo del messaggio, se inserito;</li>
          <li>
            data e ora in cui la casella è stata selezionata e l’identificativo
            tecnico della versione dell’informativa;
          </li>
          <li>
            un codice casuale usato solo per riconoscere un nuovo invio della
            stessa richiesta.
          </li>
        </ul>

        <h4 className={H4}>Modulo «Prenoto il primo colloquio»</h4>
        <p>Se la prenotazione viene accettata, nel database vengono salvati:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>nome e cognome;</li>
          <li>indirizzo email;</li>
          <li>telefono, se inserito;</li>
          <li>giorno e ora scelti e modalità (In presenza oppure Online);</li>
          <li>la dichiarazione di essere maggiorenne;</li>
          <li>
            data e ora in cui la casella dell’informativa è stata selezionata e
            l’identificativo tecnico della versione;
          </li>
          <li>
            un codice casuale usato solo per riconoscere un nuovo invio della
            stessa prenotazione.
          </li>
        </ul>
        <p>
          Il modulo di prenotazione non ha un campo per messaggi o per il motivo
          della richiesta.
        </p>

        <h4 className={H4}>Gestione degli appuntamenti</h4>
        <p>
          Per ogni appuntamento il sistema aggiunge: un codice di riferimento di
          sei caratteri, lo stato (da confermare, confermato, in attesa di
          bonifico, pagato, rifiutato, annullato, scaduto), le scadenze per la
          conferma e per il bonifico, l’importo richiesto per le sedute online,
          la data in cui sono state inviate le coordinate per il bonifico, la
          data in cui il bonifico è stato segnato come ricevuto e
          l’indicazione di una seduta gratuita.
        </p>
        <p>
          Dopo il primo colloquio la professionista può fissare dall’area
          riservata le sedute successive, singole o ripetute con una cadenza. Di
          queste vengono salvati solo giorno, ora, modalità, stato e il
          collegamento alla prima prenotazione: nome, email e telefono non
          vengono copiati e restano solo nella prima prenotazione.
        </p>
        <p>
          Per il bonifico il sito non raccoglie dati bancari di chi paga. La
          professionista segna solo che il bonifico è arrivato e in che data.
        </p>

        <h4 className={H4}>Per entrambi i moduli</h4>
        <p>
          Ogni modulo ha un campo nascosto, non destinato alle persone. Se viene
          compilato, la richiesta non viene salvata e non parte alcuna email.
        </p>
        <p>
          Per limitare gli invii ripetuti, la funzione calcola un codice HMAC
          dell’email e conserva quel codice, la finestra oraria e un contatore.
          In quella tabella non viene scritta l’email in chiaro.
        </p>
        <p>
          Il codice prevede un controllo Cloudflare Turnstile sul modulo
          «Chiedo informazioni», ma resta disattivato finché non sono
          configurate entrambe le chiavi. In questo stato il sito non invia dati
          a Cloudflare.
        </p>
        <p>
          Le pagine del sito sono ospitate su GitHub Pages. I moduli non inviano
          i campi a GitHub: dal browser li inviano alle funzioni Supabase del
          progetto. Per mostrare gli orari prenotabili il sito chiede alla
          funzione solo l’elenco degli orari liberi, senza inviare dati
          personali.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className={H3}>3. Finalità e basi giuridiche</h3>
        <p>Dal codice risultano queste finalità:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>salvare la richiesta perché la professionista possa rispondere;</li>
          <li>
            salvare la prenotazione e gestire l’appuntamento: conferma o
            rifiuto, spostamento, sedute successive, richiesta e verifica del
            bonifico per le sedute online, annullamento;
          </li>
          <li>
            inviare a chi ha compilato un modulo un’email di riepilogo, senza il
            testo del messaggio;
          </li>
          <li>
            avvisare la professionista: per il modulo informazioni con nome e
            cognome, per le prenotazioni solo con il numero di prenotazioni da
            confermare;
          </li>
          <li>
            segnare gli appuntamenti confermati in un calendario della
            professionista, con un titolo che non contiene dati della persona
            (punto 7);
          </li>
          <li>
            limitare a cinque gli invii della stessa email in un’ora e scartare
            le compilazioni automatiche del campo nascosto.
          </li>
        </ul>
        <p>
          Il codice non registra una base giuridica. Proposta da confermare
          prima della pubblicazione, non una base già adottata: per salvare
          richieste e prenotazioni, gestire gli appuntamenti e inviare le email,
          l’articolo 6, paragrafo 1, lettera b), del Regolamento, perché la
          persona chiede di essere ricontattata o di fissare un incontro; per il
          limite di invii e il campo nascosto, l’articolo 6, paragrafo 1,
          lettera f), come interesse a ridurre gli abusi dei moduli. Non risulta
          una valutazione di bilanciamento di quell’interesse.
        </p>
        <p>
          Selezionare la casella non è un consenso ai sensi dell’articolo 6,
          paragrafo 1, lettera a), e non è un consenso esplicito ai sensi
          dell’articolo 9. La casella registra che la richiesta o la
          prenotazione è stata inviata dopo aver potuto leggere questa
          informativa. Il sistema conserva l’orario e la versione tecnica.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className={H3}>4. Dati particolari relativi alla salute</h3>
        <p>
          I moduli non contengono campi su salute, diagnosi o terapia. Nel
          modulo informazioni il messaggio è facoltativo e sotto il campo è
          chiesto di non inserire dettagli sulla salute; il modulo di
          prenotazione non ha un campo di testo libero.
        </p>
        <p>
          Il fatto stesso di prenotare un colloquio con una psicologa e
          psicoterapeuta, e di avere sedute successive, può rivelare
          informazioni relative alla salute. Proposta da confermare prima della
          pubblicazione: trattare questi dati in base all’articolo 9, paragrafo
          2, lettera h), e paragrafo 3, del Regolamento, cioè per finalità di
          assistenza sanitaria da parte di una professionista soggetta al
          segreto professionale.
        </p>
        <p>
          Il testo del messaggio del modulo informazioni viene memorizzato nella
          tabella contact_requests su Supabase. Non viene copiato nell’email di
          conferma né nell’avviso alla professionista. Se una persona scrive
          comunque dati sulla salute, quei dati restano nel database. È
          opportuno non inserire dettagli clinici nei moduli.
        </p>
        <p>
          Per ridurre le informazioni che escono dal sito: l’avviso di nuova
          prenotazione contiene solo un numero; gli eventi nel calendario hanno
          solo modalità, stato del pagamento e codice; la causale del bonifico
          richiesta è «Prenotazione rif.» seguita dal codice, senza riferimenti
          alla psicoterapia.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className={H3}>5. Natura obbligatoria o facoltativa dei dati</h3>
        <p>
          Modulo informazioni: servono nome, cognome, email, servizio, modalità
          preferita della consulenza (Online / In presenza) e la selezione della
          casella. Il servizio compare già impostato su «Psicoterapia
          individuale» e può essere cambiato. Telefono, orario preferito e
          messaggio sono facoltativi.
        </p>
        <p>
          Modulo di prenotazione: servono giorno e ora, nome, cognome, email, la
          modalità (se è possibile scegliere), la dichiarazione di essere
          maggiorenne e la selezione della casella. Il telefono è facoltativo.
          La prenotazione dal sito è riservata ai maggiorenni.
        </p>
        <p>Senza gli elementi richiesti la richiesta o la prenotazione non viene salvata.</p>
      </section>

      <section className="space-y-2">
        <h3 className={H3}>6. Modalità di trattamento e misure di sicurezza</h3>
        <p>
          I dati viaggiano dal browser verso le funzioni del progetto Supabase
          (send-confirmation-email per le richieste, book per le prenotazioni)
          e, se i controlli riescono, vengono inseriti nel database. L’inserimento
          pubblico diretto nelle tabelle non è possibile: le funzioni usano la
          chiave di servizio, disponibile solo sull’ambiente Supabase. Prima di
          salvare una prenotazione la funzione ricontrolla che l’orario sia
          ancora libero, e il database impedisce due appuntamenti sovrapposti.
        </p>
        <p>
          Nel codice sono presenti il controllo del formato dei campi, un limite
          alla dimensione della richiesta, il codice HMAC per gli invii
          ripetuti, il campo nascosto, il codice contro il doppio salvataggio,
          l’esclusione del messaggio dalle email e la conversione dei caratteri
          speciali prima dell’invio delle email.
        </p>
        <p>
          Richieste e appuntamenti si consultano solo da un’area riservata del
          sito, a cui la professionista accede con password e con un secondo
          fattore (un codice generato da un’app sul telefono). Il database
          restituisce i dati solo a quell’account e solo dopo il secondo
          fattore; le modifiche agli appuntamenti passano da una funzione che
          ricontrolla lo stesso accesso. La sessione si chiude quando si chiude
          la scheda del browser o dopo 20 minuti di inattività.
        </p>
        <p>
          Le prenotazioni non confermate entro il termine indicato, i bonifici
          non arrivati entro la scadenza e le sedute proposte non confermate
          prima dell’inizio vengono segnati come scaduti e l’orario torna
          libero.
        </p>
        <p>
          Non risultano nel progetto altre misure dichiarate dallo studio, come
          certificazioni, una cifratura aggiuntiva scelta dal titolare o un
          registro dei trattamenti.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className={H3}>7. Destinatari e fornitori</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Dr.ssa Jerarda Damaris Ceglia, che riceve gli avvisi e legge
            richieste e appuntamenti dall’area riservata del sito.
          </li>
          <li>
            Supabase, che ospita il database e le funzioni. Il riferimento del
            progetto usato dal sito è cwxcfbmiwrbuaxjbeenf e il database si
            trova nella regione eu-west-1 (Irlanda). Nel repository non
            risultano il contratto né l’elenco dei sub-responsabili.
          </li>
          <li>
            Resend, che spedisce le email automatiche quando sono configurate la
            chiave e l’indirizzo del mittente. Per il riepilogo di una richiesta
            riceve email, nome, cognome, servizio, orario preferito e telefono,
            non il testo del messaggio; per il riepilogo di una prenotazione
            riceve email, nome, giorno, ora e modalità. Per l’avviso alla
            professionista riceve nome e cognome (richieste) oppure solo il
            numero di prenotazioni da confermare. Nel repository non risulta un
            contratto di nomina a responsabile.
          </li>
          <li>
            Google, per il calendario. La funzione legge dal calendario della
            professionista solo gli intervalli occupati, senza titoli, per
            calcolare gli orari liberi: in questa lettura non passano dati di
            chi prenota. Quando è collegato il calendario «Prenotazioni sito»,
            per ogni appuntamento confermato vi scrive un evento con giorno, ora
            e un titolo come «Seduta online – pagata – rif. ABC123»: nessun
            nome, email o telefono.
          </li>
          <li>
            Il servizio di posta della professionista (oggi Gmail, di Google).
            Le email di conferma, di spostamento, di rifiuto e con le coordinate
            per il bonifico vengono scritte e spedite dalla sua casella: in
            quei messaggi ci sono nome, email, giorno, ora, modalità e, per le
            sedute online, importo, coordinate bancarie della professionista e
            causale con il codice.
          </li>
          <li>
            Le banche di chi paga e della professionista, per i bonifici delle
            sedute online. Il bonifico avviene fuori dal sito; il sito non
            riceve né conserva i dati bancari di chi paga.
          </li>
          <li>
            GitHub Pages ospita le pagine. Il codice dei moduli non gli invia i
            dati inseriti.
          </li>
        </ul>
        <p>
          Cloudflare è previsto solo se Turnstile viene attivato. Allo stato
          descritto dal codice non è un destinatario dei moduli. Nel repository
          non risultano contratti con Google per il calendario e la posta.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className={H3}>8. Trasferimenti fuori dallo Spazio economico europeo</h3>
        <p>
          Il database Supabase si trova nella regione eu-west-1 (Irlanda,
          Unione Europea). Il progetto non documenta dove vengono eseguite le
          funzioni, la spedizione delle email e i servizi Google, né clausole
          contrattuali tipo, decisioni di adeguatezza o altre garanzie per
          eventuali accessi da fuori dello Spazio economico europeo da parte di
          Supabase, Resend o Google. Da completare prima della pubblicazione:
          verificare quali garanzie degli articoli 44 e seguenti del
          Regolamento si applicano.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className={H3}>9. Tempi di conservazione</h3>
        <p>Ogni richiesta salvata in contact_requests viene cancellata:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>6 mesi dopo che la professionista l’ha segnata come chiusa;</li>
          <li>
            in ogni caso 12 mesi dopo la ricezione, qualunque sia il suo stato.
          </li>
        </ul>
        <p>
          La cancellazione non è ancora automatica: l’area riservata segnala
          alla professionista le richieste che hanno superato questi tempi e le
          cancella con un comando.
        </p>
        <p>
          Per le prenotazioni e gli appuntamenti il progetto non prevede ancora
          una cancellazione a tempo: restano nell’archivio dell’area riservata
          finché la professionista non li elimina. Eliminando la prima
          prenotazione si eliminano anche tutte le sedute collegate e i relativi
          eventi del calendario. Da completare prima della pubblicazione:
          stabilire per quanto tempo conservare gli appuntamenti, tenendo conto
          degli obblighi fiscali e professionali, che riguardano anche documenti
          tenuti fuori dal sito, come le ricevute.
        </p>
        <p>
          Una richiesta o una prenotazione può essere cancellata anche prima, su
          domanda dell’interessato (paragrafo 10), salvo i dati che la
          professionista deve conservare per obbligo di legge.
        </p>
        <p>
          I codici HMAC del limite di invii sono organizzati in finestre orarie.
          Esiste una funzione per cancellare le finestre più vecchie di 48 ore,
          ma nel progetto non risulta avviata in automatico. Finché non viene
          eseguita, quei codici possono restare oltre le 48 ore.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className={H3}>10. Diritti dell’interessato</h3>
        <p>
          Nei casi previsti dagli articoli 15-22 del Regolamento si possono
          chiedere accesso, rettifica, cancellazione, limitazione e portabilità,
          e ci si può opporre al trattamento. La portabilità riguarda i
          trattamenti indicati dall’articolo 20. La revoca del consenso riguarda
          i trattamenti fondati sul consenso: non è lo strumento di questa
          richiesta, se vengono confermate le basi proposte ai punti 3 e 4.
        </p>
        <p>
          Se per il limite di invii viene confermato l’interesse legittimo, ci
          si può opporre secondo l’articolo 21. Il limite si applica solo
          all’invio dei moduli, al massimo cinque volte in un’ora per lo stesso
          indirizzo email, e non decide nient’altro sulla persona. Nessuna
          decisione sugli appuntamenti viene presa in modo automatico: conferme,
          rifiuti e spostamenti li decide la professionista. Le uniche
          operazioni automatiche sono le scadenze descritte al punto 6.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className={H3}>11. Modalità per esercitare i diritti</h3>
        <p>
          La richiesta si può inviare all’email del punto 1. Il progetto non
          prevede un altro canale, una PEC o un modulo dedicato ai diritti.
        </p>
        <p>
          L’articolo 12, paragrafo 3, del Regolamento prevede che il titolare
          risponda in linea di massima entro un mese, con la possibilità di
          proroga nei casi indicati dal Regolamento. Non risulta una procedura
          interna diversa.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className={H3}>12. Diritto di reclamo</h3>
        <p>
          Si può proporre reclamo a un’autorità di controllo, in particolare
          nello Stato membro di residenza, di lavoro o del luogo della presunta
          violazione, ai sensi dell’articolo 77 del Regolamento. In Italia
          l’autorità è il Garante per la protezione dei dati personali. Sede
          pubblica: Piazza Venezia 11, 00187 Roma. Modalità e recapiti aggiornati
          sono pubblicati su{" "}
          <a className={LINK} href="https://www.garanteprivacy.it" rel="noopener noreferrer">
            www.garanteprivacy.it
          </a>
          .
        </p>
      </section>

      <section className="space-y-2">
        <h3 className={H3}>13. Data e versione</h3>
        <p>Testo aggiornato il 24 novembre 2026.</p>
        <p>
          Identificativo tecnico di questa versione: «2026-11-24». Viene salvato
          insieme a ogni richiesta e prenotazione, così si può sapere quale
          testo era in vigore al momento dell’invio.
        </p>
      </section>
    </article>
  );
}
