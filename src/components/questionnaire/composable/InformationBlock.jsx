import RichText from './RichText'

export default function InformationBlock({ config }) {
  return (
    <section className="cs-question-card cs-information-block">
      {config.title ? (
        <div className="cs-information-title">
          <RichText text={config.title} />
        </div>
      ) : null}

      {config.image_url ? (
        <figure className="cs-information-image-wrap">
          <img
            className="cs-information-image"
            src={config.image_url}
            alt={config.image_alt ?? ''}
            style={{ maxWidth: config.image_max_width ?? '680px' }}
          />
          {config.image_caption ? (
            <figcaption>{config.image_caption}</figcaption>
          ) : null}
        </figure>
      ) : null}

      {config.body ? (
        <div className="cs-information-body">
          <RichText text={config.body} />
        </div>
      ) : null}
    </section>
  )
}
