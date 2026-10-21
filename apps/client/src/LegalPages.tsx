import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

export type LegalPageKind = "imprint" | "privacy";

function LegalLayout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const { i18n } = useTranslation();
  const back = i18n.language.startsWith("de")
    ? "Zurück zur Startseite"
    : "Back to home";
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} · Collection52`;
    return () => {
      document.title = previousTitle;
    };
  }, [title]);
  return (
    <article className="legal-page">
      <a className="legal-back" href="/">
        ← {back}
      </a>
      <header className="legal-hero">
        <h1>{title}</h1>
      </header>
      <div className="legal-content">{children}</div>
    </article>
  );
}

function Contact({
  english = false,
  details = true,
}: {
  english?: boolean;
  details?: boolean;
}) {
  return (
    <address>
      <strong>Dawid Czech</strong>
      <br />
      Kaiser-Otto-Ring 6<br />
      39106 Magdeburg
      {details && (
        <span className="legal-contact-lines">
          <span>
            {english ? "Phone" : "Telefon"}:{" "}
            <a href="tel:+4915679799165">015679799165</a>
          </span>
          <span>
            {english ? "E-mail" : "E-Mail"}:{" "}
            <a href="mailto:collection52@steinente.de">
              collection52@steinente.de
            </a>
          </span>
        </span>
      )}
    </address>
  );
}

export function LegalPage({ kind }: { kind: LegalPageKind }) {
  const { i18n } = useTranslation();
  const english = !i18n.language.startsWith("de");
  if (kind === "imprint")
    return english ? <ImprintEnglish /> : <ImprintGerman />;
  return english ? <PrivacyEnglish /> : <PrivacyGerman />;
}

function ImprintGerman() {
  return (
    <LegalLayout title="Impressum">
      <section>
        <Contact details={false} />
      </section>
      <section>
        <h2>Kontakt</h2>
        <p>
          Sie erreichen uns telefonisch unter{" "}
          <a href="tel:+4915679799165">015679799165</a> oder per E-Mail an{" "}
          <a href="mailto:collection52@steinente.de">
            collection52@steinente.de
          </a>
          .
        </p>
      </section>
    </LegalLayout>
  );
}

function ImprintEnglish() {
  return (
    <LegalLayout title="Site Notice">
      <section>
        <Contact english details={false} />
      </section>
      <section>
        <h2>Contact</h2>
        <p>
          You can reach us by phone at{" "}
          <a href="tel:+4915679799165">015679799165</a> or by e-mail at{" "}
          <a href="mailto:collection52@steinente.de">
            collection52@steinente.de
          </a>
          .
        </p>
      </section>
    </LegalLayout>
  );
}

function PrivacyGerman() {
  return (
    <LegalLayout title="Datenschutzerklärung">
      <section>
        <h2>1. Datenschutz auf einen Blick</h2>
        <h3>Allgemeine Hinweise</h3>
        <p>
          Die folgenden Hinweise geben einen einfachen Überblick darüber, was
          mit Ihren personenbezogenen Daten passiert, wenn Sie diese Website
          besuchen. Personenbezogene Daten sind alle Daten, mit denen Sie
          persönlich identifiziert werden können. Ausführliche Informationen zum
          Thema Datenschutz entnehmen Sie unserer unter diesem Text aufgeführten
          Datenschutzerklärung.
        </p>
        <h3>Datenerfassung auf dieser Website</h3>
        <h4>
          Wer ist verantwortlich für die Datenerfassung auf dieser Website?
        </h4>
        <p>
          Die Datenverarbeitung auf dieser Website erfolgt durch den
          Websitebetreiber. Dessen Kontaktdaten können Sie dem Abschnitt
          „Hinweis zur verantwortlichen Stelle“ in dieser Datenschutzerklärung
          entnehmen.
        </p>
        <h4>Wie erfassen wir Ihre Daten?</h4>
        <p>
          Ihre Daten werden zum einen dadurch erhoben, dass Sie uns diese
          mitteilen. Hierbei kann es sich z. B. um Daten handeln, die Sie in ein
          Kontaktformular eingeben.
        </p>
        <p>
          Andere Daten werden automatisch oder nach Ihrer Einwilligung beim
          Besuch der Website durch unsere IT-Systeme erfasst. Das sind vor allem
          technische Daten (z. B. Internetbrowser, Betriebssystem oder Uhrzeit
          des Seitenaufrufs). Die Erfassung dieser Daten erfolgt automatisch,
          sobald Sie diese Website betreten.
        </p>
        <h4>Wofür nutzen wir Ihre Daten?</h4>
        <p>
          Ein Teil der Daten wird erhoben, um eine fehlerfreie Bereitstellung
          der Website zu gewährleisten. Andere Daten können zur Analyse Ihres
          Nutzerverhaltens verwendet werden. Sofern über die Website Verträge
          geschlossen oder angebahnt werden können, werden die übermittelten
          Daten auch für Vertragsangebote, Bestellungen oder sonstige
          Auftragsanfragen verarbeitet.
        </p>
        <h4>Welche Rechte haben Sie bezüglich Ihrer Daten?</h4>
        <p>
          Sie haben jederzeit das Recht, unentgeltlich Auskunft über Herkunft,
          Empfänger und Zweck Ihrer gespeicherten personenbezogenen Daten zu
          erhalten. Sie haben außerdem ein Recht, die Berichtigung oder Löschung
          dieser Daten zu verlangen. Wenn Sie eine Einwilligung zur
          Datenverarbeitung erteilt haben, können Sie diese Einwilligung
          jederzeit für die Zukunft widerrufen. Außerdem haben Sie das Recht,
          unter bestimmten Umständen die Einschränkung der Verarbeitung Ihrer
          personenbezogenen Daten zu verlangen. Des Weiteren steht Ihnen ein
          Beschwerderecht bei der zuständigen Aufsichtsbehörde zu.
        </p>
        <p>
          Hierzu sowie zu weiteren Fragen zum Thema Datenschutz können Sie sich
          jederzeit an uns wenden.
        </p>
      </section>

      <section>
        <h2>2. Hosting und Content Delivery Networks (CDN)</h2>
        <h3>Cloudflare</h3>
        <p>
          Wir nutzen den Service „Cloudflare“. Anbieter ist die Cloudflare Inc.,
          101 Townsend St., San Francisco, CA 94107, USA (im Folgenden
          „Cloudflare“).
        </p>
        <p>
          Cloudflare bietet ein weltweit verteiltes Content Delivery Network mit
          DNS an. Dabei wird technisch der Informationstransfer zwischen Ihrem
          Browser und unserer Website über das Netzwerk von Cloudflare geleitet.
          Das versetzt Cloudflare in die Lage, den Datenverkehr zwischen Ihrem
          Browser und unserer Website zu analysieren und als Filter zwischen
          unseren Servern und potenziell bösartigem Datenverkehr aus dem
          Internet zu dienen. Hierbei kann Cloudflare auch Cookies oder sonstige
          Technologien zur Wiedererkennung von Internetnutzern einsetzen, die
          jedoch allein zum hier beschriebenen Zweck verwendet werden.
        </p>
        <p>
          Der Einsatz von Cloudflare beruht auf unserem berechtigten Interesse
          an einer möglichst fehlerfreien und sicheren Bereitstellung unseres
          Webangebotes (Art. 6 Abs. 1 lit. f DSGVO).
        </p>
        <p>
          Die Datenübertragung in die USA wird auf die Standardvertragsklauseln
          der EU-Kommission gestützt. Details und weitere Informationen zum
          Thema Sicherheit und Datenschutz bei Cloudflare finden Sie in der{" "}
          <a
            href="https://www.cloudflare.com/privacypolicy/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Datenschutzerklärung von Cloudflare
          </a>
          .
        </p>
        <p>
          Das Unternehmen verfügt über eine Zertifizierung nach dem „EU-US Data
          Privacy Framework“ (DPF). Der DPF ist ein Übereinkommen zwischen der
          Europäischen Union und den USA, das die Einhaltung europäischer
          Datenschutzstandards bei Datenverarbeitungen in den USA gewährleisten
          soll. Jedes nach dem DPF zertifizierte Unternehmen verpflichtet sich,
          diese Datenschutzstandards einzuhalten. Weitere Informationen erhalten
          Sie beim{" "}
          <a
            href="https://www.dataprivacyframework.gov/participant/5666"
            target="_blank"
            rel="noopener noreferrer"
          >
            Data Privacy Framework
          </a>
          .
        </p>
      </section>

      <section>
        <h2>3. Allgemeine Hinweise und Pflichtinformationen</h2>
        <h3>Datenschutz</h3>
        <p>
          Die Betreiber dieser Seiten nehmen den Schutz Ihrer persönlichen Daten
          sehr ernst. Wir behandeln Ihre personenbezogenen Daten vertraulich und
          entsprechend den gesetzlichen Datenschutzvorschriften sowie dieser
          Datenschutzerklärung.
        </p>
        <p>
          Wenn Sie diese Website benutzen, werden verschiedene personenbezogene
          Daten erhoben. Personenbezogene Daten sind Daten, mit denen Sie
          persönlich identifiziert werden können. Die vorliegende
          Datenschutzerklärung erläutert, welche Daten wir erheben und wofür wir
          sie nutzen. Sie erläutert auch, wie und zu welchem Zweck das
          geschieht.
        </p>
        <p>
          Wir weisen darauf hin, dass die Datenübertragung im Internet (z. B.
          bei der Kommunikation per E-Mail) Sicherheitslücken aufweisen kann.
          Ein lückenloser Schutz der Daten vor dem Zugriff durch Dritte ist
          nicht möglich.
        </p>
        <h3>Hinweis zur verantwortlichen Stelle</h3>
        <p>
          Die verantwortliche Stelle für die Datenverarbeitung auf dieser
          Website ist:
        </p>
        <Contact />
        <p>
          Verantwortliche Stelle ist die natürliche oder juristische Person, die
          allein oder gemeinsam mit anderen über die Zwecke und Mittel der
          Verarbeitung von personenbezogenen Daten (z. B. Namen, E-Mail-Adressen
          o. Ä.) entscheidet.
        </p>
        <h3>Speicherdauer</h3>
        <p>
          Soweit innerhalb dieser Datenschutzerklärung keine speziellere
          Speicherdauer genannt wurde, verbleiben Ihre personenbezogenen Daten
          bei uns, bis der Zweck für die Datenverarbeitung entfällt. Wenn Sie
          ein berechtigtes Löschersuchen geltend machen oder eine Einwilligung
          zur Datenverarbeitung widerrufen, werden Ihre Daten gelöscht, sofern
          wir keine anderen rechtlich zulässigen Gründe für die Speicherung
          Ihrer personenbezogenen Daten haben (z. B. steuer- oder
          handelsrechtliche Aufbewahrungsfristen); im letztgenannten Fall
          erfolgt die Löschung nach Fortfall dieser Gründe.
        </p>
        <h3>
          Allgemeine Hinweise zu den Rechtsgrundlagen der Datenverarbeitung auf
          dieser Website
        </h3>
        <p>
          Sofern Sie in die Datenverarbeitung eingewilligt haben, verarbeiten
          wir Ihre personenbezogenen Daten auf Grundlage von Art. 6 Abs. 1 lit.
          a DSGVO bzw. Art. 9 Abs. 2 lit. a DSGVO, sofern besondere
          Datenkategorien nach Art. 9 Abs. 1 DSGVO verarbeitet werden. Im Falle
          einer ausdrücklichen Einwilligung in die Übertragung personenbezogener
          Daten in Drittstaaten erfolgt die Datenverarbeitung außerdem auf
          Grundlage von Art. 49 Abs. 1 lit. a DSGVO. Sofern Sie in die
          Speicherung von Cookies oder in den Zugriff auf Informationen in Ihr
          Endgerät (z. B. via Device-Fingerprinting) eingewilligt haben, erfolgt
          die Datenverarbeitung zusätzlich auf Grundlage von § 25 Abs. 1 TDDDG.
          Die Einwilligung ist jederzeit widerrufbar. Sind Ihre Daten zur
          Vertragserfüllung oder zur Durchführung vorvertraglicher Maßnahmen
          erforderlich, verarbeiten wir Ihre Daten auf Grundlage des Art. 6 Abs.
          1 lit. b DSGVO. Des Weiteren verarbeiten wir Ihre Daten, sofern dies
          zur Erfüllung einer rechtlichen Verpflichtung erforderlich ist, auf
          Grundlage des Art. 6 Abs. 1 lit. c DSGVO. Die Datenverarbeitung kann
          ferner auf Grundlage unseres berechtigten Interesses nach Art. 6 Abs.
          1 lit. f DSGVO erfolgen. Über die jeweils im Einzelfall einschlägigen
          Rechtsgrundlagen wird in den folgenden Absätzen dieser
          Datenschutzerklärung informiert.
        </p>
        <h3>Empfänger von personenbezogenen Daten</h3>
        <p>
          Im Rahmen unserer Geschäftstätigkeit arbeiten wir mit verschiedenen
          externen Stellen zusammen. Dabei ist teilweise auch eine Übermittlung
          von personenbezogenen Daten an diese externen Stellen erforderlich.
          Wir geben personenbezogene Daten nur dann an externe Stellen weiter,
          wenn dies im Rahmen einer Vertragserfüllung erforderlich ist, wenn wir
          gesetzlich hierzu verpflichtet sind (z. B. Weitergabe von Daten an
          Steuerbehörden), wenn wir ein berechtigtes Interesse nach Art. 6 Abs.
          1 lit. f DSGVO an der Weitergabe haben oder wenn eine sonstige
          Rechtsgrundlage die Datenweitergabe erlaubt. Beim Einsatz von
          Auftragsverarbeitern geben wir personenbezogene Daten unserer Kunden
          nur auf Grundlage eines gültigen Vertrags über Auftragsverarbeitung
          weiter. Im Falle einer gemeinsamen Verarbeitung wird ein Vertrag über
          gemeinsame Verarbeitung geschlossen.
        </p>
        <h3>Widerruf Ihrer Einwilligung zur Datenverarbeitung</h3>
        <p>
          Viele Datenverarbeitungsvorgänge sind nur mit Ihrer ausdrücklichen
          Einwilligung möglich. Sie können eine bereits erteilte Einwilligung
          jederzeit widerrufen. Die Rechtmäßigkeit der bis zum Widerruf
          erfolgten Datenverarbeitung bleibt vom Widerruf unberührt.
        </p>
        <h3>
          Widerspruchsrecht gegen die Datenerhebung in besonderen Fällen sowie
          gegen Direktwerbung (Art. 21 DSGVO)
        </h3>
        <div className="legal-emphasis">
          <p>
            Wenn die Datenverarbeitung auf Grundlage von Art. 6 Abs. 1 lit. e
            oder f DSGVO erfolgt, haben Sie jederzeit das Recht, aus Gründen,
            die sich aus Ihrer besonderen Situation ergeben, gegen die
            Verarbeitung Ihrer personenbezogenen Daten Widerspruch einzulegen;
            dies gilt auch für ein auf diese Bestimmungen gestütztes Profiling.
            Die jeweilige Rechtsgrundlage, auf der eine Verarbeitung beruht,
            entnehmen Sie dieser Datenschutzerklärung. Wenn Sie Widerspruch
            einlegen, werden wir Ihre betroffenen personenbezogenen Daten nicht
            mehr verarbeiten, es sei denn, wir können zwingende schutzwürdige
            Gründe für die Verarbeitung nachweisen, die Ihre Interessen, Rechte
            und Freiheiten überwiegen, oder die Verarbeitung dient der
            Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen
            (Widerspruch nach Art. 21 Abs. 1 DSGVO).
          </p>
          <p>
            Werden Ihre personenbezogenen Daten verarbeitet, um Direktwerbung zu
            betreiben, so haben Sie das Recht, jederzeit Widerspruch gegen die
            Verarbeitung Sie betreffender personenbezogener Daten zum Zwecke
            derartiger Werbung einzulegen; dies gilt auch für das Profiling,
            soweit es mit solcher Direktwerbung in Verbindung steht. Wenn Sie
            widersprechen, werden Ihre personenbezogenen Daten anschließend
            nicht mehr zum Zwecke der Direktwerbung verwendet (Widerspruch nach
            Art. 21 Abs. 2 DSGVO).
          </p>
        </div>
        <h3>Beschwerderecht bei der zuständigen Aufsichtsbehörde</h3>
        <p>
          Im Falle von Verstößen gegen die DSGVO steht den Betroffenen ein
          Beschwerderecht bei einer Aufsichtsbehörde zu, insbesondere in dem
          Mitgliedstaat ihres gewöhnlichen Aufenthalts, ihres Arbeitsplatzes
          oder des Orts des mutmaßlichen Verstoßes. Das Beschwerderecht besteht
          unbeschadet anderweitiger verwaltungsrechtlicher oder gerichtlicher
          Rechtsbehelfe.
        </p>
        <h3>Recht auf Datenübertragbarkeit</h3>
        <p>
          Sie haben das Recht, Daten, die wir auf Grundlage Ihrer Einwilligung
          oder in Erfüllung eines Vertrags automatisiert verarbeiten, an sich
          oder an einen Dritten in einem gängigen, maschinenlesbaren Format
          aushändigen zu lassen. Sofern Sie die direkte Übertragung der Daten an
          einen anderen Verantwortlichen verlangen, erfolgt dies nur, soweit es
          technisch machbar ist.
        </p>
        <h3>Auskunft, Berichtigung und Löschung</h3>
        <p>
          Sie haben im Rahmen der geltenden gesetzlichen Bestimmungen jederzeit
          das Recht auf unentgeltliche Auskunft über Ihre gespeicherten
          personenbezogenen Daten, deren Herkunft und Empfänger und den Zweck
          der Datenverarbeitung und gegebenenfalls ein Recht auf Berichtigung
          oder Löschung dieser Daten. Hierzu sowie zu weiteren Fragen zum Thema
          personenbezogene Daten können Sie sich jederzeit an uns wenden.
        </p>
        <h3>Recht auf Einschränkung der Verarbeitung</h3>
        <p>
          Sie haben das Recht, die Einschränkung der Verarbeitung Ihrer
          personenbezogenen Daten zu verlangen. Hierzu können Sie sich jederzeit
          an uns wenden. Das Recht auf Einschränkung der Verarbeitung besteht in
          folgenden Fällen:
        </p>
        <ul>
          <li>
            Wenn Sie die Richtigkeit Ihrer bei uns gespeicherten
            personenbezogenen Daten bestreiten, benötigen wir in der Regel Zeit,
            um dies zu überprüfen. Für die Dauer der Prüfung haben Sie das
            Recht, die Einschränkung der Verarbeitung Ihrer personenbezogenen
            Daten zu verlangen.
          </li>
          <li>
            Wenn die Verarbeitung Ihrer personenbezogenen Daten unrechtmäßig
            geschah oder geschieht, können Sie statt der Löschung die
            Einschränkung der Datenverarbeitung verlangen.
          </li>
          <li>
            Wenn wir Ihre personenbezogenen Daten nicht mehr benötigen, Sie sie
            jedoch zur Ausübung, Verteidigung oder Geltendmachung von
            Rechtsansprüchen benötigen, haben Sie das Recht, statt der Löschung
            die Einschränkung der Datenverarbeitung zu verlangen.
          </li>
          <li>
            Wenn Sie einen Widerspruch nach Art. 21 Abs. 1 DSGVO eingelegt
            haben, muss eine Abwägung zwischen Ihren und unseren Interessen
            vorgenommen werden. Solange noch nicht feststeht, wessen Interessen
            überwiegen, haben Sie das Recht, die Einschränkung der Verarbeitung
            Ihrer personenbezogenen Daten zu verlangen.
          </li>
        </ul>
        <p>
          Wenn Sie die Verarbeitung Ihrer personenbezogenen Daten eingeschränkt
          haben, dürfen diese Daten – von ihrer Speicherung abgesehen – nur mit
          Ihrer Einwilligung oder zur Geltendmachung, Ausübung oder Verteidigung
          von Rechtsansprüchen oder zum Schutz der Rechte einer anderen
          natürlichen oder juristischen Person oder aus Gründen eines wichtigen
          öffentlichen Interesses der Europäischen Union oder eines
          Mitgliedstaats verarbeitet werden.
        </p>
        <h3>SSL- bzw. TLS-Verschlüsselung</h3>
        <p>
          Diese Seite nutzt aus Sicherheitsgründen und zum Schutz der
          Übertragung vertraulicher Inhalte, wie zum Beispiel Bestellungen oder
          Anfragen, die Sie an uns als Seitenbetreiber senden, eine SSL- bzw.
          TLS-Verschlüsselung. Eine verschlüsselte Verbindung erkennen Sie
          daran, dass die Adresszeile des Browsers von „http://“ auf „https://“
          wechselt und an dem Schloss-Symbol in Ihrer Browserzeile.
        </p>
        <p>
          Wenn die SSL- bzw. TLS-Verschlüsselung aktiviert ist, können die
          Daten, die Sie an uns übermitteln, nicht von Dritten mitgelesen
          werden.
        </p>
        <h3>Widerspruch gegen Werbe-E-Mails</h3>
        <p>
          Der Nutzung von im Rahmen der Impressumspflicht veröffentlichten
          Kontaktdaten zur Übersendung von nicht ausdrücklich angeforderter
          Werbung und Informationsmaterialien wird hiermit widersprochen. Die
          Betreiber der Seiten behalten sich ausdrücklich rechtliche Schritte im
          Falle der unverlangten Zusendung von Werbeinformationen, etwa durch
          Spam-E-Mails, vor.
        </p>
      </section>

      <section>
        <h2>4. Datenerfassung auf dieser Website</h2>
        <h3>Kommunikation via WhatsApp</h3>
        <p>
          Für die Kommunikation mit unseren Kunden und sonstigen Dritten nutzen
          wir unter anderem den Instant-Messaging-Dienst WhatsApp. Anbieter ist
          die WhatsApp Ireland Limited, Merrion Road, Dublin 4, D04 X2K5,
          Irland.
        </p>
        <p>
          Die Kommunikation erfolgt über eine Ende-zu-Ende-Verschlüsselung
          (Peer-to-Peer), die verhindert, dass WhatsApp oder sonstige Dritte
          Zugriff auf die Kommunikationsinhalte erlangen können. WhatsApp erhält
          jedoch Zugriff auf Metadaten, die im Zuge des Kommunikationsvorgangs
          entstehen (z. B. Absender, Empfänger und Zeitpunkt). Wir weisen ferner
          darauf hin, dass WhatsApp nach eigener Aussage personenbezogene Daten
          seiner Nutzer mit seiner in den USA ansässigen Konzernmutter Meta
          teilt. Weitere Details zur Datenverarbeitung finden Sie in der{" "}
          <a
            href="https://www.whatsapp.com/legal/#privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Datenschutzrichtlinie von WhatsApp
          </a>
          .
        </p>
        <p>
          Der Einsatz von WhatsApp erfolgt auf Grundlage unseres berechtigten
          Interesses an einer möglichst schnellen und effektiven Kommunikation
          mit Kunden, Interessenten und sonstigen Geschäfts- und
          Vertragspartnern (Art. 6 Abs. 1 lit. f DSGVO). Sofern eine
          entsprechende Einwilligung abgefragt wurde, erfolgt die
          Datenverarbeitung ausschließlich auf Grundlage der Einwilligung; diese
          ist jederzeit mit Wirkung für die Zukunft widerrufbar.
        </p>
        <p>
          Die zwischen Ihnen und uns auf WhatsApp ausgetauschten
          Kommunikationsinhalte verbleiben bei uns, bis Sie uns zur Löschung
          auffordern, Ihre Einwilligung zur Speicherung widerrufen oder der
          Zweck für die Datenspeicherung entfällt (z. B. nach abgeschlossener
          Bearbeitung Ihrer Anfrage). Zwingende gesetzliche Bestimmungen –
          insbesondere Aufbewahrungsfristen – bleiben unberührt.
        </p>
        <p>
          Das Unternehmen verfügt über eine Zertifizierung nach dem „EU-US Data
          Privacy Framework“ (DPF). Der DPF ist ein Übereinkommen zwischen der
          Europäischen Union und den USA, das die Einhaltung europäischer
          Datenschutzstandards bei Datenverarbeitungen in den USA gewährleisten
          soll. Jedes nach dem DPF zertifizierte Unternehmen verpflichtet sich,
          diese Datenschutzstandards einzuhalten. Weitere Informationen erhalten
          Sie beim{" "}
          <a
            href="https://www.dataprivacyframework.gov/participant/7735"
            target="_blank"
            rel="noopener noreferrer"
          >
            Data Privacy Framework
          </a>
          .
        </p>
        <p>Wir nutzen WhatsApp in der Variante „WhatsApp Business“.</p>
        <p>
          Die Datenübertragung in die USA wird auf die Standardvertragsklauseln
          der EU-Kommission gestützt. Details finden Sie im{" "}
          <a
            href="https://www.whatsapp.com/legal/business-data-transfer-addendum"
            target="_blank"
            rel="noopener noreferrer"
          >
            Business Data Transfer Addendum von WhatsApp
          </a>
          .
        </p>
        <p>
          Wir haben unsere WhatsApp-Accounts so eingestellt, dass kein
          automatischer Datenabgleich mit dem Adressbuch auf den im Einsatz
          befindlichen Smartphones erfolgt.
        </p>
      </section>
    </LegalLayout>
  );
}

function PrivacyEnglish() {
  return (
    <LegalLayout title="Privacy Policy">
      <section>
        <h2>1. An overview of data protection</h2>
        <h3>General information</h3>
        <p>
          The following information will provide you with an easy-to-navigate
          overview of what will happen with your personal data when you visit
          this website. The term “personal data” comprises all data that can be
          used to personally identify you. For detailed information about data
          protection, please consult our Privacy Policy below.
        </p>
        <h3>Data recording on this website</h3>
        <h4>
          Who is the responsible party for recording data on this website (i.e.
          the controller)?
        </h4>
        <p>
          The data on this website is processed by the operator of the website,
          whose contact information is available under “Information about the
          responsible party” in this Privacy Policy.
        </p>
        <h4>How do we record your data?</h4>
        <p>
          We collect your data when you share it with us. This may, for
          instance, be information you enter into a contact form.
        </p>
        <p>
          Other data is recorded by our IT systems automatically or after you
          consent to its recording during your website visit. This data
          primarily comprises technical information (e.g. web browser, operating
          system, or time the site was accessed). This information is recorded
          automatically when you access this website.
        </p>
        <h4>What do we use your data for?</h4>
        <p>
          A portion of the information is generated to guarantee the error-free
          provision of the website. Other data may be used to analyze your usage
          patterns. If contracts can be concluded or initiated via the website,
          transmitted data will also be processed for contract offers, orders,
          or other order enquiries.
        </p>
        <h4>What rights do you have concerning your information?</h4>
        <p>
          You have the right to receive information about the source,
          recipients, and purposes of your archived personal data at any time
          without paying a fee. You also have the right to demand that your data
          be rectified or erased. If you have consented to data processing, you
          may revoke this consent at any time with effect for the future.
          Moreover, you have the right to demand that the processing of your
          data be restricted under certain circumstances. You also have the
          right to lodge a complaint with the competent supervisory authority.
        </p>
        <p>
          Please contact us at any time if you have questions about this or any
          other data-protection-related issue.
        </p>
      </section>

      <section>
        <h2>2. Hosting and Content Delivery Networks (CDN)</h2>
        <h3>Cloudflare</h3>
        <p>
          We use the “Cloudflare” service provided by Cloudflare Inc., 101
          Townsend St., San Francisco, CA 94107, USA (hereinafter referred to as
          “Cloudflare”).
        </p>
        <p>
          Cloudflare offers a worldwide content delivery network with DNS. As a
          result, information transferred between your browser and our website
          is technically routed through Cloudflare’s network. This enables
          Cloudflare to analyze data transactions between your browser and our
          website and to act as a filter between our servers and potentially
          malicious Internet traffic. In this context, Cloudflare may also use
          cookies or other technologies to recognize Internet users, which are
          used solely for the purpose described here.
        </p>
        <p>
          The use of Cloudflare is based on our legitimate interest in providing
          website offerings that are as error-free and secure as possible (Art.
          6(1)(f) GDPR).
        </p>
        <p>
          Data transmission to the United States is based on the Standard
          Contractual Clauses of the European Commission. Details and further
          information on security and data protection at Cloudflare can be found
          in{" "}
          <a
            href="https://www.cloudflare.com/privacypolicy/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Cloudflare’s Privacy Policy
          </a>
          .
        </p>
        <p>
          The company is certified under the EU-US Data Privacy Framework (DPF).
          The DPF is an agreement between the European Union and the United
          States intended to ensure compliance with European data protection
          standards for data processing in the United States. Every company
          certified under the DPF is obliged to comply with these standards.
          Further information is available from the{" "}
          <a
            href="https://www.dataprivacyframework.gov/participant/5666"
            target="_blank"
            rel="noopener noreferrer"
          >
            Data Privacy Framework
          </a>
          .
        </p>
      </section>

      <section>
        <h2>3. General and mandatory information</h2>
        <h3>Data protection</h3>
        <p>
          The operators of this website take the protection of your personal
          data very seriously. We handle your personal data as confidential
          information and in compliance with statutory data protection
          regulations and this Privacy Policy.
        </p>
        <p>
          Whenever you use this website, a variety of personal information is
          collected. Personal data comprises data that can be used to personally
          identify you. This Privacy Policy explains which data we collect, what
          we use it for, and how and for what purpose it is collected.
        </p>
        <p>
          Please note that the transmission of data via the Internet (e.g.
          through e-mail communication) may be subject to security gaps. It is
          not possible to completely protect data against third-party access.
        </p>
        <h3>Information about the responsible party (controller)</h3>
        <p>
          The controller responsible for data processing on this website is:
        </p>
        <Contact english />
        <p>
          The controller is the natural person or legal entity that, alone or
          jointly with others, makes decisions about the purposes and means of
          processing personal data (e.g. names, e-mail addresses, etc.).
        </p>
        <h3>Storage duration</h3>
        <p>
          Unless a more specific storage period has been specified in this
          Privacy Policy, your personal data will remain with us until the
          purpose for which it was collected no longer applies. If you submit a
          justified request for deletion or revoke your consent to data
          processing, your data will be deleted unless we have other legally
          permissible reasons for storing your personal data (e.g. retention
          periods under tax or commercial law); in the latter case, deletion
          will take place after these reasons cease to apply.
        </p>
        <h3>
          General information on the legal basis for data processing on this
          website
        </h3>
        <p>
          If you have consented to data processing, we process your personal
          data on the basis of Art. 6(1)(a) GDPR or Art. 9(2)(a) GDPR if special
          categories of data are processed according to Art. 9(1) GDPR. In the
          case of explicit consent to the transfer of personal data to third
          countries, processing is also based on Art. 49(1)(a) GDPR. If you have
          consented to the storage of cookies or access to information on your
          device (e.g. via device fingerprinting), processing is additionally
          based on § 25(1) TDDDG. Consent may be revoked at any time. If your
          data is required for the performance of a contract or pre-contractual
          measures, we process it on the basis of Art. 6(1)(b) GDPR. If your
          data is required to fulfill a legal obligation, we process it on the
          basis of Art. 6(1)(c) GDPR. Processing may also be based on our
          legitimate interest pursuant to Art. 6(1)(f) GDPR. Information on the
          applicable legal basis in each case is provided in the following
          sections of this Privacy Policy.
        </p>
        <h3>Recipients of personal data</h3>
        <p>
          In the course of our business activities, we cooperate with various
          external parties. In some cases, this requires personal data to be
          transferred to external parties. We disclose personal data only when
          required for the performance of a contract, when legally obligated to
          do so (e.g. disclosure to tax authorities), when we have a legitimate
          interest pursuant to Art. 6(1)(f) GDPR, or when another legal basis
          permits disclosure. When using processors, we disclose our customers’
          personal data only on the basis of a valid data processing agreement.
          In the case of joint processing, a joint processing agreement is
          concluded.
        </p>
        <h3>Revocation of your consent to data processing</h3>
        <p>
          A wide range of data processing operations are possible only with your
          express consent. You may revoke consent you have already given at any
          time. This does not affect the lawfulness of data processing carried
          out before revocation.
        </p>
        <h3>
          Right to object to data collection in special cases and to direct
          advertising (Art. 21 GDPR)
        </h3>
        <div className="legal-emphasis">
          <p>
            If data is processed on the basis of Art. 6(1)(e) or (f) GDPR, you
            have the right to object at any time to the processing of your
            personal data on grounds arising from your particular situation.
            This also applies to profiling based on these provisions. The
            applicable legal basis is stated in this Privacy Policy. If you
            object, we will no longer process the affected personal data unless
            we can demonstrate compelling legitimate grounds for processing that
            override your interests, rights, and freedoms, or processing serves
            to establish, exercise, or defend legal claims (objection pursuant
            to Art. 21(1) GDPR).
          </p>
          <p>
            If your personal data is processed for direct advertising, you have
            the right to object at any time to the processing of personal data
            concerning you for such advertising. This also applies to profiling
            insofar as it is related to such direct advertising. If you object,
            your personal data will subsequently no longer be used for direct
            advertising (objection pursuant to Art. 21(2) GDPR).
          </p>
        </div>
        <h3>
          Right to lodge a complaint with the competent supervisory authority
        </h3>
        <p>
          In the event of violations of the GDPR, data subjects have the right
          to lodge a complaint with a supervisory authority, in particular in
          the member state of their habitual residence, place of work, or the
          place of the alleged violation. This right is without prejudice to any
          other administrative or judicial remedies.
        </p>
        <h3>Right to data portability</h3>
        <p>
          You have the right to have data that we process automatically on the
          basis of your consent or in fulfillment of a contract handed over to
          you or a third party in a common, machine-readable format. If you
          request the direct transfer of data to another controller, this will
          be done only where technically feasible.
        </p>
        <h3>Information, rectification, and erasure</h3>
        <p>
          Within the scope of applicable statutory provisions, you have the
          right at any time to receive information free of charge about your
          stored personal data, its source and recipients, and the purpose of
          processing. You may also have a right to rectification or erasure of
          this data. Please contact us at any time if you have questions about
          personal data.
        </p>
        <h3>Right to restriction of processing</h3>
        <p>
          You have the right to demand restrictions on the processing of your
          personal data. You may contact us at any time. This right applies in
          the following cases:
        </p>
        <ul>
          <li>
            If you dispute the correctness of your personal data stored by us,
            we will generally need time to verify this claim. During the
            investigation, you have the right to demand that we restrict
            processing of your personal data.
          </li>
          <li>
            If the processing of your personal data was or is unlawful, you may
            demand restriction of processing instead of erasure.
          </li>
          <li>
            If we no longer need your personal data but you require it to
            exercise, defend, or assert legal claims, you have the right to
            demand restriction of processing instead of erasure.
          </li>
          <li>
            If you have raised an objection pursuant to Art. 21(1) GDPR, your
            rights and our rights must be weighed against each other. Until it
            has been determined whose interests prevail, you have the right to
            demand restriction of processing.
          </li>
        </ul>
        <p>
          If you have restricted the processing of your personal data, this data
          – with the exception of storage – may be processed only with your
          consent, to establish, exercise, or defend legal claims, to protect
          the rights of another natural or legal person, or for reasons of
          important public interest cited by the European Union or an EU member
          state.
        </p>
        <h3>SSL and TLS encryption</h3>
        <p>
          For security reasons and to protect the transmission of confidential
          content, such as orders or enquiries you submit to us, this website
          uses SSL or TLS encryption. You can recognize an encrypted connection
          when the browser’s address line changes from “http://” to “https://”
          and a lock icon appears.
        </p>
        <p>
          If SSL or TLS encryption is activated, data you transmit to us cannot
          be read by third parties.
        </p>
        <h3>Rejection of unsolicited e-mails</h3>
        <p>
          We object to the use of contact information published as part of the
          mandatory site notice to send promotional and informational material
          that we have not expressly requested. The website operators reserve
          the right to take legal action in the event of unsolicited promotional
          information, such as spam e-mails.
        </p>
      </section>

      <section>
        <h2>4. Recording of data on this website</h2>
        <h3>Communication via WhatsApp</h3>
        <p>
          For communication with customers and other third parties, one service
          we use is the instant messaging service WhatsApp. The provider is
          WhatsApp Ireland Limited, Merrion Road, Dublin 4, D04 X2K5, Ireland.
        </p>
        <p>
          Communication is encrypted end-to-end (peer-to-peer), which prevents
          WhatsApp or other third parties from accessing communication content.
          However, WhatsApp gains access to metadata created during
          communication (e.g. sender, recipient, and time). We also point out
          that WhatsApp states that it shares its users’ personal data with its
          US-based parent company Meta. Further details can be found in the{" "}
          <a
            href="https://www.whatsapp.com/legal/#privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp Privacy Policy
          </a>
          .
        </p>
        <p>
          The use of WhatsApp is based on our legitimate interest in
          communicating as quickly and effectively as possible with customers,
          interested parties, and other business and contractual partners (Art.
          6(1)(f) GDPR). If consent has been requested, processing is carried
          out exclusively on the basis of that consent, which may be revoked at
          any time with effect for the future.
        </p>
        <p>
          Communication content exchanged between you and us on WhatsApp remains
          with us until you request deletion, revoke your consent to storage, or
          the purpose for storage ceases to apply (e.g. after your request has
          been processed). Mandatory statutory provisions, in particular
          retention periods, remain unaffected.
        </p>
        <p>
          The company is certified under the EU-US Data Privacy Framework (DPF).
          The DPF is an agreement between the European Union and the United
          States intended to ensure compliance with European data protection
          standards for data processing in the United States. Every company
          certified under the DPF is obliged to comply with these standards.
          Further information is available from the{" "}
          <a
            href="https://www.dataprivacyframework.gov/participant/7735"
            target="_blank"
            rel="noopener noreferrer"
          >
            Data Privacy Framework
          </a>
          .
        </p>
        <p>We use the “WhatsApp Business” version.</p>
        <p>
          Data transmission to the United States is based on the Standard
          Contractual Clauses of the European Commission. Details can be found
          in{" "}
          <a
            href="https://www.whatsapp.com/legal/business-data-transfer-addendum?lang=en"
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp’s Business Data Transfer Addendum
          </a>
          .
        </p>
        <p>
          We have configured our WhatsApp accounts so that they do not
          automatically synchronize data with the address books on the
          smartphones in use.
        </p>
      </section>
    </LegalLayout>
  );
}
