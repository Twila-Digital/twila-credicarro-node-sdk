export class QueryStringBuilder {
  private readonly parameters: string[] = [];

  add(name: string, value: string | number | undefined | null): this {
    if (value === undefined || value === null) return this;

    this.parameters.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
    return this;
  }

  build(path: string): string {
    if (this.parameters.length === 0) return path;

    return `${path}?${this.parameters.join('&')}`;
  }
}
