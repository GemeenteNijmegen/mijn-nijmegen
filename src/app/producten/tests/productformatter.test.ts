import { ProductFormatter } from '../ProductFormatter';

// nl-NL date formatting reference values
const NL_DATES = {
  aanmaak_datum: '19 maart 2026',
  update_datum: '20 maart 2026',
  product_type: {
    publicatie_start_datum: '19 januari 2026',
    publicatie_eind_datum: '27 januari 2026',
    aanmaak_datum: '13 januari 2026',
    update_datum: '24 februari 2026',
    themas: {
      aanmaak_datum: '13 januari 2026',
      update_datum: '13 januari 2026',
    },
  },
};

function buildProduct(overrides: Record<string, any> = {}) {
  return {
    uuid: '4a379e32-92f5-424a-8f96-e993f66a0c30',
    naam: 'Standplaatsvergunning vierdaagse',
    aanmaak_datum: '2026-03-19T09:39:02.480940+01:00',
    update_datum: '2026-03-20T10:43:23.918260+01:00',
    product_type: {
      publicatie_start_datum: '2026-01-19T00:00:00.000Z',
      publicatie_eind_datum: '2026-01-27T00:00:00.000Z',
      aanmaak_datum: '2026-01-13T10:59:29.978359+01:00',
      update_datum: '2026-02-24T10:07:24.781455+01:00',
      themas: {
        aanmaak_datum: '2026-01-13T10:58:46.740115+01:00',
        update_datum: '2026-01-13T10:58:46.740141+01:00',
      },
    },
    aanvraag_zaak_url:
      'https://openzaak.woweb.app/zaken/api/v1/zaken/99047d22-20d9-41e8-9ab1-c1e8e8b42915',
    ...overrides,
  };
}

describe('ProductFormatter', () => {

  describe('format()', () => {

    it('returns a formatted object', () => {
      const result = ProductFormatter.format(buildProduct());
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('does not mutate the original input object', () => {
      const product = buildProduct();
      const originalAanmaakDatum = product.aanmaak_datum;

      ProductFormatter.format(product);

      expect(product.aanmaak_datum).toBe(originalAanmaakDatum);
    });

    it('preserves non-date, non-url fields unchanged', () => {
      const product = buildProduct();
      const result = ProductFormatter.format(product);

      expect(result.uuid).toBe(product.uuid);
      expect(result.naam).toBe(product.naam);
    });

    describe('date formatting', () => {

      it('formats top-level aanmaak_datum to nl-NL', () => {
        const result = ProductFormatter.format(buildProduct());
        expect(result.aanmaak_datum).toBe(NL_DATES.aanmaak_datum);
      });

      it('formats top-level update_datum to nl-NL', () => {
        const result = ProductFormatter.format(buildProduct());
        expect(result.update_datum).toBe(NL_DATES.update_datum);
      });

      it('formats product_type.publicatie_start_datum to nl-NL', () => {
        const result = ProductFormatter.format(buildProduct());
        expect(result.product_type.publicatie_start_datum)
          .toBe(NL_DATES.product_type.publicatie_start_datum);
      });

      it('formats product_type.publicatie_eind_datum to nl-NL', () => {
        const result = ProductFormatter.format(buildProduct());
        expect(result.product_type.publicatie_eind_datum)
          .toBe(NL_DATES.product_type.publicatie_eind_datum);
      });

      it('formats product_type.aanmaak_datum to nl-NL', () => {
        const result = ProductFormatter.format(buildProduct());
        expect(result.product_type.aanmaak_datum)
          .toBe(NL_DATES.product_type.aanmaak_datum);
      });

      it('formats product_type.update_datum to nl-NL', () => {
        const result = ProductFormatter.format(buildProduct());
        expect(result.product_type.update_datum)
          .toBe(NL_DATES.product_type.update_datum);
      });

      it('formats product_type.themas.aanmaak_datum to nl-NL', () => {
        const result = ProductFormatter.format(buildProduct());
        expect(result.product_type.themas.aanmaak_datum)
          .toBe(NL_DATES.product_type.themas.aanmaak_datum);
      });

      it('formats product_type.themas.update_datum to nl-NL', () => {
        const result = ProductFormatter.format(buildProduct());
        expect(result.product_type.themas.update_datum)
          .toBe(NL_DATES.product_type.themas.update_datum);
      });

      it('skips a date field gracefully when it is missing', () => {
        const product = buildProduct({ aanmaak_datum: undefined });
        const result = ProductFormatter.format(product);

        expect(result.aanmaak_datum).toBeUndefined();
        // Other dates should still be formatted
        expect(result.update_datum).toBe(NL_DATES.update_datum);
      });

      it('skips nested date fields gracefully when product_type is missing', () => {
        const product = buildProduct({ product_type: undefined });
        expect(() => ProductFormatter.format(product)).not.toThrow();
      });

    });

    describe('url mapping', () => {

      it('replaces the openzaak base URL with the internal route', () => {
        const zaakId = '99047d22-20d9-41e8-9ab1-c1e8e8b42915';
        const result = ProductFormatter.format(buildProduct());

        expect(result.aanvraag_zaak_url).toBe(`/zaken/zaak/${zaakId}`);
      });

      it('leaves aanvraag_zaak_url unchanged when it does not match the search string', () => {
        const originalUrl = 'https://other-system.example.com/zaken/99047d22';
        const product = buildProduct({ aanvraag_zaak_url: originalUrl });
        const result = ProductFormatter.format(product);

        expect(result.aanvraag_zaak_url).toBe(originalUrl);
      });

      it('skips url mapping gracefully when aanvraag_zaak_url is missing', () => {
        const product = buildProduct({ aanvraag_zaak_url: undefined });
        expect(() => ProductFormatter.format(product)).not.toThrow();
      });

    });

  });

  describe('getByPath()', () => {

    it('resolves a simple top-level key', () => {
      const result = (ProductFormatter as any).getByPath({ foo: 'bar' }, 'foo');
      expect(result).toBe('bar');
    });

    it('resolves a deeply nested path', () => {
      const result = (ProductFormatter as any).getByPath(
        { a: { b: { c: 'deep' } } },
        'a.b.c',
      );
      expect(result).toBe('deep');
    });

    it('returns undefined for a missing intermediate key', () => {
      const result = (ProductFormatter as any).getByPath({ a: {} }, 'a.b.c');
      expect(result).toBeUndefined();
    });

    it('returns undefined when called with an empty object', () => {
      const result = (ProductFormatter as any).getByPath({}, 'a.b');
      expect(result).toBeUndefined();
    });

  });

  describe('setByPath()', () => {

    it('sets a top-level key', () => {
      const obj = { foo: 'old' };
      (ProductFormatter as any).setByPath(obj, 'foo', 'new');
      expect(obj.foo).toBe('new');
    });

    it('sets a deeply nested key', () => {
      const obj = { a: { b: { c: 'old' } } };
      (ProductFormatter as any).setByPath(obj, 'a.b.c', 'new');
      expect(obj.a.b.c).toBe('new');
    });

    it('does nothing when an intermediate key is missing', () => {
      const obj = { a: {} } as any;
      expect(() =>
        (ProductFormatter as any).setByPath(obj, 'a.b.c', 'value'),
      ).not.toThrow();
      expect(obj.a.b).toBeUndefined();
    });

  });

});
