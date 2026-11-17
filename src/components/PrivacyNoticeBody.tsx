export default function PrivacyNoticeBody() {
  return (
    <article className="space-y-6 text-sm text-stone-700 leading-relaxed">
      <p>
        Questa informativa descrive solo i trattamenti del modulo contatti di
        questo sito, secondo gli articoli 12, 13 e 9 del Regolamento (UE)
        2016/679. È una bozza: i punti segnati come da completare non sono
        verificati nel progetto e vanno inseriti prima di considerarla definitiva.
      </p>

      <section className="space-y-2">
        <h3 className="font-cormorant text-2xl text-sage-700">
          1. Identità e contatti del titolare
        </h3>
        <p>
          Titolare del trattamento: Dr.ssa Jerarda Damaris Ceglia.
        </p>
        <p>
          Contatto presente nel sito e usato dalla funzione che invia gli avvisi
          del modulo:{" "}
          <a
            className="text-sage-700 underline underline-offset-2"
            href="mailto:jerardadamarisceglia@gmail.com"
          >
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
        <h3 className="font-cormorant text-2xl text-sage-700">
          2. Tipologie di dati raccolti nel modulo
        </h3>
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
          <li>testo del messaggio;</li>
          <li>
            data e ora in cui la casella è stata selezionata e l’identificativo
            tecnico della versione «2026-11-10»;
          </li>
          <li>
            un codice casuale usato solo per riconoscere un nuovo invio della
            stessa richiesta.
          </li>
        </ul>
        <p>
          Il modulo ha un campo nascosto, non destinato alle persone. Se viene
          compilato, la richiesta non viene salvata e non parte alcuna email.
        </p>
        <p>
          Per limitare gli invii ripetuti, la funzione calcola un codice HMAC
          dell’email e conserva quel codice, la finestra oraria e un contatore.
          In quella tabella non viene scritta l’email in chiaro.
        </p>
        <p>
          Il codice prevede un controllo Cloudflare Turnstile, ma resta
          disattivato finché non sono configurate entrambe le chiavi. In questo
          stato il sito non invia dati a Cloudflare.
        </p>
        <p>
          Le pagine del sito sono ospitate su GitHub Pages. Il modulo non invia
          i campi a GitHub: dal browser li invia alla funzione Supabase del
          progetto.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-cormorant text-2xl text-sage-700">
          3. Finalità e basi giuridiche
        </h3>
        <p>Dal codice risultano queste finalità:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>salvare la richiesta perché la professionista possa rispondere;</li>
          <li>
            inviare a chi ha compilato il modulo un’email di riepilogo, senza il
            testo del messaggio;
          </li>
          <li>
            inviare alla professionista un avviso con nome e cognome, senza il
            testo del messaggio;
          </li>
          <li>
            limitare a cinque gli invii della stessa email in un’ora e scartare
            le compilazioni automatiche del campo nascosto.
          </li>
        </ul>
        <p>
          Il codice non registra una base giuridica. Proposta da confermare
          prima della pubblicazione, non una base già adottata: per salvare la
          richiesta e inviare le due email, l’articolo 6, paragrafo 1, lettera
          b), del Regolamento, perché la persona chiede di essere ricontattata
          in vista di un eventuale incontro; per il limite di invii e il campo
          nascosto, l’articolo 6, paragrafo 1, lettera f), come interesse a
          ridurre gli abusi del modulo. Non risulta una valutazione di
          bilanciamento di quell’interesse.
        </p>
        <p>
          Selezionare la casella non è un consenso ai sensi dell’articolo 6,
          paragrafo 1, lettera a), e non è un consenso esplicito ai sensi
          dell’articolo 9. La casella registra che la richiesta è stata inviata
          dopo aver potuto leggere questa informativa. Il sistema conserva
          l’orario e la versione tecnica «2026-11-10».
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-cormorant text-2xl text-sage-700">
          4. Dati particolari relativi alla salute
        </h3>
        <p>
          Il modulo non contiene campi su salute, diagnosi o terapia. Sotto il
          messaggio è chiesto di non inserire informazioni cliniche, diagnosi o
          dettagli sanitari.
        </p>
        <p>
          Il testo del messaggio viene comunque memorizzato nella tabella
          contact_requests su Supabase. Non viene copiato nell’email di conferma
          né nell’avviso alla professionista. È opportuno non inserire dettagli
          clinici nel modulo.
        </p>
        <p>
          Se una persona scrive comunque dati sulla salute, quei dati restano nel
          database. Nel progetto non è indicata una condizione dell’articolo 9.
          Da completare prima della pubblicazione: decidere come escludere o
          trattare questi dati.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-cormorant text-2xl text-sage-700">
          5. Natura obbligatoria o facoltativa dei dati
        </h3>
        <p>
          Per inviare la richiesta servono nome, cognome, email, servizio,
          modalità preferita della consulenza (Online / In presenza),
          messaggio e la selezione della casella. Senza questi elementi la
          richiesta non viene salvata. Il servizio compare già impostato su
          «Psicoterapia individuale» e può essere cambiato.
        </p>
        <p>Telefono e orario preferito sono facoltativi.</p>
      </section>

      <section className="space-y-2">
        <h3 className="font-cormorant text-2xl text-sage-700">
          6. Modalità di trattamento e misure di sicurezza
        </h3>
        <p>
          I dati viaggiano dal browser verso la funzione
          send-confirmation-email del progetto Supabase e, se i controlli
          riescono, vengono inseriti in contact_requests. L’inserimento pubblico
          diretto nella tabella è stato rimosso: la funzione usa la chiave di
          servizio, disponibile solo sull’ambiente Supabase.
        </p>
        <p>
          Nel codice sono presenti il controllo del formato dei campi, un limite
          alla dimensione della richiesta, il codice HMAC per gli invii
          ripetuti, il campo nascosto, il codice contro il doppio salvataggio,
          l’esclusione del messaggio dalle email e la conversione dei caratteri
          speciali prima dell’invio delle email.
        </p>
        <p>
          Non risultano nel progetto altre misure dichiarate dallo studio, come
          certificazioni, una cifratura aggiuntiva scelta dal titolare o un
          registro dei trattamenti.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-cormorant text-2xl text-sage-700">
          7. Destinatari e fornitori
        </h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Dr.ssa Jerarda Damaris Ceglia, che riceve l’avviso e può leggere le
            richieste nel database.
          </li>
          <li>
            Supabase, che ospita il database e la funzione. Il riferimento del
            progetto usato dal sito è cwxcfbmiwrbuaxjbeenf. Nel repository non
            risultano il contratto, la regione del database né l’elenco dei
            sub-responsabili.
          </li>
          <li>
            Resend, che spedisce le email quando sono configurate la chiave e
            l’indirizzo del mittente. Per l’email a chi ha scritto, Resend
            riceve nome, cognome, servizio, orario preferito e telefono, non il
            testo del messaggio. Per l’avviso alla professionista riceve nome e
            cognome. L’indirizzo mittente non è scritto nel codice. Nel
            repository non risulta un contratto di nomina a responsabile.
          </li>
          <li>
            GitHub Pages ospita le pagine. Il codice del modulo non gli invia i
            dati inseriti.
          </li>
        </ul>
        <p>
          Cloudflare è previsto solo se Turnstile viene attivato. Allo stato
          descritto dal codice non è un destinatario del modulo.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-cormorant text-2xl text-sage-700">
          8. Trasferimenti fuori dallo Spazio economico europeo
        </h3>
        <p>
          Il progetto non indica la regione in cui Supabase conserva il database
          e non documenta clausole contrattuali tipo, decisioni di adeguatezza o
          altre garanzie per Supabase o Resend. Da completare prima della
          pubblicazione: verificare dove sono trattati i dati e quali garanzie
          degli articoli 44 e seguenti del Regolamento si applicano.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-cormorant text-2xl text-sage-700">
          9. Tempi di conservazione
        </h3>
        <p>
          Le richieste salvate in contact_requests non hanno, nel codice, una
          scadenza né una cancellazione automatica. Da completare prima della
          pubblicazione: indicare per quanto tempo restano conservate.
        </p>
        <p>
          I codici HMAC del limite di invii sono organizzati in finestre orarie.
          Esiste una funzione per cancellare le finestre più vecchie di 48 ore,
          ma nel progetto non risulta avviata in automatico. Finché non viene
          eseguita, quei codici possono restare oltre le 48 ore.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-cormorant text-2xl text-sage-700">
          10. Diritti dell’interessato
        </h3>
        <p>
          Nei casi previsti dagli articoli 15-22 del Regolamento si possono
          chiedere accesso, rettifica, cancellazione, limitazione e portabilità,
          e ci si può opporre al trattamento. La portabilità riguarda i
          trattamenti indicati dall’articolo 20. La revoca del consenso riguarda
          i trattamenti fondati sul consenso: non è lo strumento di questa
          richiesta, se viene confermata la base proposta al punto 3.
        </p>
        <p>
          Se per il limite di invii viene confermato l’interesse legittimo, ci
          si può opporre secondo l’articolo 21. Il limite si applica solo
          all’invio del modulo, al massimo cinque volte in un’ora per lo stesso
          indirizzo email, e non decide nient’altro sulla persona.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-cormorant text-2xl text-sage-700">
          11. Modalità per esercitare i diritti
        </h3>
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
        <h3 className="font-cormorant text-2xl text-sage-700">
          12. Diritto di reclamo
        </h3>
        <p>
          Si può proporre reclamo a un’autorità di controllo, in particolare
          nello Stato membro di residenza, di lavoro o del luogo della presunta
          violazione, ai sensi dell’articolo 77 del Regolamento. In Italia
          l’autorità è il Garante per la protezione dei dati personali. Sede
          pubblica: Piazza Venezia 11, 00187 Roma. Modalità e recapiti aggiornati
          sono pubblicati su{" "}
          <a
            className="text-sage-700 underline underline-offset-2"
            href="https://www.garanteprivacy.it"
            rel="noopener noreferrer"
          >
            www.garanteprivacy.it
          </a>
          .
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-cormorant text-2xl text-sage-700">
          13. Data e versione
        </h3>
        <p>Testo proposto il 17 novembre 2026.</p>
        <p>
          La funzione già pubblicata accetta soltanto l’identificativo tecnico
          «2026-11-10» e lo salva insieme alla richiesta. Questo testo non ha
          ancora lo stesso identificativo. Da completare prima di una
          pubblicazione allineata: aggiornare insieme il testo e l’identificativo
          registrato.
        </p>
      </section>
    </article>
  );
}
