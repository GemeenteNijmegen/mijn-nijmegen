export class ProductFormatter {
  static format(productResult: any): any {

    const dates = [
      'aanmaak_datum',
      'update_datum',
      'product_type.publicatie_start_datum',
      'product_type.publicatie_eind_datum',
      'product_type.aanmaak_datum',
      'product_type.update_datum',
      'product_type.themas.aanmaak_datum',
      'product_type.themas.update_datum',
    ];

    const url_mapping = [{
      key: 'aanvraag_zaak_url',
      search: 'https://openzaak.woweb.app/zaken/api/v1/zaken/',
      replace: '/zaken/zaak/',
    }];

    const formatted = structuredClone(productResult);
    const dateFormatter = new Intl.DateTimeFormat('nl-NL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    for (const date of dates) {
      const dateString = this.getByPath(formatted, date);
      if (dateString) {
        const formattedDate = dateFormatter.format(new Date(dateString));
        this.setByPath(formatted, date, formattedDate);
      }
    }

    for (const map of url_mapping) {
      const orig = this.getByPath(formatted, map.key);
      if (orig) {
        const replaced = orig.replace(map.search, map.replace);
        this.setByPath(formatted, map.key, replaced);
      }
    }

    return formatted;
  }

  private static getByPath(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private static setByPath(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const last = keys.pop()!;
    const target = keys.reduce((current, key) => current?.[key], obj);
    if (target !== undefined && target !== null) {
      target[last] = value;
    }
  }
}
