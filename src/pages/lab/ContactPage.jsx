// ContactPage.jsx
// Static contact information for RADlab.
// Update text directly in this file — no data file needed given low change frequency.

export default function ContactPage() {
  return (
    <div className="lab-page">

      {/* Location */}
      <section className="lab-section">
        <h2 className="lab-section__heading">Location</h2>
        <address className="contact-address">
          Deerfield Hall<br />
          Department of Psychology<br />
          University of Toronto Mississauga<br />
          3359 Mississauga Road<br />
          Mississauga, Ontario L5L 1C6<br />
          Canada
        </address>
      </section>

      {/* Joining the lab */}
      <section className="lab-section">
        <h2 className="lab-section__heading">Joining the Lab</h2>

        <div className="contact-blocks">

          <div className="contact-block">
            <h3 className="contact-block__title">Research Assistants</h3>
            <p className="contact-block__body">
              Volunteers interested in assisting Prof. Farb and lab members with research are welcome to reach out.
              Research assistants support participant scheduling, experimental data collection, data management,
              and assistance with literature review, ethics protocols, and manuscript preparation.
            </p>
            <div className="contact-block__actions">
              <a className="contact-cta" href="mailto:info@radlab.zone">Email the lab →</a>
              <a
                className="contact-cta"
                href="https://utorontopsych.az1.qualtrics.com/jfe/form/SV_8HdT3QCK6f4BTtb"
                target="_blank"
                rel="noreferrer"
              >
                RA Application Form →
              </a>
            </div>
          </div>

          <div className="contact-block">
            <h3 className="contact-block__title">Graduate Students</h3>
            <p className="contact-block__body">
              The lab has grown to the point where we are not likely to accept new graduate student applications at this time.
              For general information on applying to graduate school in psychology at the University of Toronto,
              please visit the department website.
            </p>
            <div className="contact-block__actions">
              <a
                className="contact-cta"
                href="https://www.psych.utoronto.ca/prospective-graduate-students/about-our-tri-campus-graduate-program"
                target="_blank"
                rel="noreferrer"
              >
                UofT Psychology Graduate Program →
              </a>
            </div>
          </div>

          <div className="contact-block">
            <h3 className="contact-block__title">Postdoctoral Scholars</h3>
            <p className="contact-block__body">
              Prof. Farb is open to discussing partnerships with relatively independent scholars seeking high-level
              mentorship on projects related to the lab's goals. We are not sponsoring postdoctoral fellows at this
              time, but would consider working with interested PhDs to develop funding applications.
              Please identify a specific funding opportunity when reaching out.
            </p>
            <div className="contact-block__actions">
              <a className="contact-cta" href="mailto:info@radlab.zone">Contact Prof. Farb →</a>
            </div>
          </div>

        </div>
      </section>

    </div>
  );
}
