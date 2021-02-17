import {
  property,
  Base,
  propertyArray,
  SurveyModel,
  HashTable,
  LocalizableString,
  JsonObjectProperty,
  Serializer,
  PageModel,
  surveyLocalization,
  ILocalizableString,
  ItemValue,
  IActionBarItem,
} from "survey-knockout";
import { unparse, parse } from "papaparse";
import { editorLocalization } from "../editorLocalization";
import { settings } from "../settings";

export class TranslationItemBase extends Base {
  constructor(public name: string, protected translation: ITranslationLocales) {
    super();
  }
  public get isGroup() {
    return false;
  }
  public fillLocales(locales: Array<string>) {}
  public mergeLocaleWithDefault(loc: string) {}
  protected fireOnObjCreating(obj: Base = null) {
    if (this.translation) {
      if (!obj) obj = this;
      this.translation.fireOnObjCreating(obj);
    }
  }
}

export class TranslationItemString extends Base {
  constructor(public locString: ILocalizableString, public locale: string) {
    super();
    this.text = this.locString.getLocaleText(this.locale);
  }
  @property() text: string;
  protected onPropertyValueChanged(name: string, oldValue: any, newValue: any) {
    super.onPropertyValueChanged(name, oldValue, newValue);
    if (name === "text") {
      this.locString.setLocaleText(this.locale, newValue);
    }
  }
  public getType(): string {
    return "translationitemstring";
  }
}

export class TranslationItem extends TranslationItemBase {
  private hashValues: HashTable<TranslationItemString>;
  public customText: string;
  public afterRender: any;
  constructor(
    public name: string,
    public locString: LocalizableString,
    public defaultValue: string = "",
    translation: ITranslationLocales,
    private context: any
  ) {
    super(name, translation);
    if (!!this.translation) {
      this.readOnly = this.translation.readOnly;
    }
    this.hashValues = {};
    var self = this;
    this.afterRender = function (el: any, data: any) {
      if (!!self.translation) {
        self.translation.translateItemAfterRender(self, el, data.locale);
      }
    };
    this.fireOnObjCreating();
  }
  public getType(): string {
    return "translationitem";
  }
  @property({ defaultValue: false }) readOnly: boolean;
  public get text() {
    return !!this.customText ? this.customText : this.localizableName;
  }
  public get localizableName(): string {
    return editorLocalization.getPropertyName(this.name);
  }
  public getLocText(loc: string): string {
    return this.locString.getLocaleText(loc);
  }
  public setLocText(loc: string, newValue: string) {
    this.locString.setLocaleText(loc, newValue);
    !!this.translation.tranlationChangedCallback &&
      this.translation.tranlationChangedCallback(
        loc,
        this.name,
        newValue,
        this.context
      );
  }
  public values(loc: string): TranslationItemString {
    if (!this.hashValues[loc]) {
      var val = new TranslationItemString(this.locString, loc);
      this.hashValues[loc] = val;
      this.fireOnObjCreating(val);
    }
    return this.hashValues[loc];
  }

  public fillLocales(locales: Array<string>) {
    var keys = this.getKeys();
    for (var i = 0; i < keys.length; i++) {
      let key = keys[i];
      if (
        !!key &&
        locales.indexOf(key) < 0 &&
        key !== LocalizableString.defaultLocale
      ) {
        locales.push(key);
      }
    }
  }
  private getKeys(): Array<string> {
    if (this.locString["getLocales"]) return this.locString["getLocales"]();
    var json = this.locString.getJson();
    if (!json || typeof json === "string") return [];
    var res = [];
    for (var key in json) {
      res.push(key);
    }
    return res;
  }
  public mergeLocaleWithDefault(loc: string) {
    var locText = this.locString.getLocaleText(loc);
    if (!locText) return;
    this.locString.setLocaleText("", locText);
    this.locString.setLocaleText(loc, null);
  }
}

export interface ITranslationLocales {
  localesStr: any;
  showAllStrings: boolean;
  readOnly: boolean;
  getLocaleName(loc: string): string;
  availableTranlationsChangedCallback: () => void;
  tranlationChangedCallback: (
    locale: string,
    name: string,
    value: string,
    context: any
  ) => void;
  translateItemAfterRender(item: TranslationItem, el: any, locale: string);
  fireOnObjCreating(obj: Base);
}

export class TranslationGroup extends TranslationItemBase {
  private isRootValue: boolean = false;
  private itemValues: Array<TranslationItemBase>;
  constructor(
    public name,
    public obj: any,
    translation: ITranslationLocales = null,
    public text: string = ""
  ) {
    super(name, translation);
    if (!this.text) {
      this.text = name;
    }
    this.reset();
    this.fireOnObjCreating();
  }
  public getType(): string {
    return "translationgroup";
  }
  @property({ defaultValue: false }) expanded: boolean;
  @property({ defaultValue: true }) showHeader: boolean;
  public get items(): Array<TranslationItemBase> {
    return this.itemValues;
  }
  public get locItems(): Array<TranslationItem> {
    return this.itemValues.filter(
      (item) => item instanceof TranslationItem
    ) as Array<TranslationItem>;
  }
  public get isRoot(): boolean {
    return this.isRootValue;
  }
  setAsRoot() {
    this.isRootValue = true;
    this.expanded = true;
  }
  public getItemByName(name: string): TranslationItemBase {
    for (var i = 0; i < this.itemValues.length; i++) {
      if (this.itemValues[i].name == name) return this.itemValues[i];
    }
    return null;
  }
  public get groups(): Array<TranslationGroup> {
    return this.itemValues.filter(
      (item) => item instanceof TranslationGroup
    ) as Array<TranslationGroup>;
  }

  public get isGroup() {
    return true;
  }
  public get locales() {
    return !!this.translation ? this.translation.localesStr : null;
  }
  public get localeCount(): number {
    if (!this.locales) return 0;
    var locales = this.locales;
    var res = 0;
    for (var i = 0; i < locales.length; i++) {
      if (locales[i].visible) res++;
    }
    return res;
  }
  public get locWidth(): string {
    var count = this.localeCount;
    if (count < 2) return "100%";
    return Math.floor(100 / count).toString() + "%";
  }
  public getLocaleName(loc: string) {
    return this.translation
      ? this.translation.getLocaleName(loc)
      : editorLocalization.getLocaleName(loc);
  }
  public reset() {
    this.itemValues = [];
    this.fillItems();
  }
  public fillLocales(locales: Array<string>) {
    for (var i = 0; i < this.items.length; i++) {
      this.items[i].fillLocales(locales);
    }
  }
  public get showAllStrings(): boolean {
    return !!this.translation ? this.translation.showAllStrings : true;
  }
  public get hasItems(): boolean {
    if (this.locItems.length > 0) return true;
    var groups = this.groups;
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].hasItems) return true;
    }
    return false;
  }
  public mergeLocaleWithDefault(loc: string) {
    this.itemValues.forEach((item) => item.mergeLocaleWithDefault(loc));
  }
  private fillItems() {
    if (this.isItemValueArray(this.obj)) {
      this.createItemValuesLocale();
      return;
    }
    if (!this.obj || !this.obj.getType) return;
    var properties = this.getLocalizedProperties(this.obj);
    for (var i = 0; i < properties.length; i++) {
      var property = properties[i];
      var item = this.createTranslationItem(this.obj, properties[i]);
      if (!!item) {
        this.itemValues.push(item);
      }
    }
    properties = this.getArrayProperties(this.obj);
    for (var i = 0; i < properties.length; i++) {
      var property = properties[i];
      var value = this.obj[property.name];
      //If ItemValue array?
      if (this.isItemValueArray(value)) {
        var group = new TranslationGroup(
          property.name,
          value,
          this.translation,
          editorLocalization.getPropertyName(property.name)
        );
        if (group.hasItems) {
          this.itemValues.push(group);
        }
      } else {
        this.createGroups(value, property);
      }
    }
    this.sortItems();
    this.keepOnGroupExpanded();
  }
  private keepOnGroupExpanded() {
    if (this.items.length == 1 && this.groups.length == 1) {
      var gr = this.groups[0];
      gr.expanded = true;
      if (gr.obj.getType() == "page") {
        gr.showHeader = false;
      }
    }
  }
  public expandAll() {
    this.expandCollapseAll(true);
  }
  public collapseAll() {
    this.expandCollapseAll(false);
  }
  private expandCollapseAll(isExpand: boolean) {
    if (!this.isRoot) {
      this.expanded = isExpand;
    }
    for (var i = 0; i < this.groups.length; i++) {
      if (isExpand) {
        this.groups[i].expandAll();
      } else {
        this.groups[i].collapseAll();
      }
    }
    this.keepOnGroupExpanded();
  }
  private sortItems() {
    if (!settings.traslation.sortByName) return;
    this.itemValues.sort(function (
      a: TranslationItemBase,
      b: TranslationItemBase
    ) {
      if (!a.name) return -1;
      if (!b.name) return 1;
      return a.name.localeCompare(b.name);
    });
  }
  private getLocalizedProperties(obj: any): Array<JsonObjectProperty> {
    var res = [];
    var properties = Serializer.getPropertiesByObj(obj);
    for (var i = 0; i < properties.length; i++) {
      var property = properties[i];
      if (!property.isSerializable || !property.isLocalizable) continue;
      if (property.readOnly || !property.visible) continue;
      res.push(property);
    }
    return res;
  }
  private getArrayProperties(obj: any): Array<JsonObjectProperty> {
    var res = [];
    var properties = Serializer.getPropertiesByObj(obj);
    for (var i = 0; i < properties.length; i++) {
      var property = properties[i];
      if (property.isSerializable === false) continue;
      var value = obj[property.name];
      if (!!value && Array.isArray(value) && value.length > 0) {
        res.push(property);
      }
    }
    return res;
  }
  private createTranslationItem(
    obj: any,
    property: JsonObjectProperty
  ): TranslationItem {
    var defaultValue = this.getDefaultValue(obj, property);
    var locStr = <LocalizableString>obj[property.serializationProperty];
    if (!locStr) return null;
    if (!this.showAllStrings && !defaultValue && locStr.isEmpty) return null;
    return new TranslationItem(
      property.name,
      locStr,
      defaultValue,
      this.translation,
      obj
    );
  }
  private getDefaultValue(obj: any, property: JsonObjectProperty): string {
    if (
      property.name == "title" &&
      property.isLocalizable &&
      !!property.serializationProperty
    ) {
      var locStr = <LocalizableString>obj[property.serializationProperty];
      if (
        !!locStr &&
        obj.getType() != "page" &&
        (!!locStr.onGetTextCallback || locStr["onRenderedHtmlCallback"])
      )
        return obj["name"];
    }
    return "";
  }
  private isItemValueArray(val: any) {
    return (
      !!val &&
      Array.isArray(val) &&
      val.length > 0 &&
      !!val[0] &&
      !!val[0]["getType"] &&
      !!val[0]["setData"] &&
      !!val[0]["setLocText"]
    );
  }
  private createGroups(value: any, property: JsonObjectProperty) {
    for (var i = 0; i < value.length; i++) {
      var obj = value[i];
      if (!!obj && obj.getType) {
        var name = obj["name"];
        var text = editorLocalization.getPropertyName(name);
        if (!name) {
          var index = "[" + i.toString() + "]";
          name = property.name + index;
          text = editorLocalization.getPropertyName(property.name) + index;
        }
        var group = new TranslationGroup(name, obj, this.translation, text);
        if (group.hasItems) {
          this.itemValues.push(group);
        }
      }
    }
  }
  private createItemValuesLocale() {
    for (var i = 0; i < this.obj.length; i++) {
      var val = this.obj[i];
      var canAdd =
        this.showAllStrings || !val.locText.isEmpty || isNaN(val.value);
      if (!canAdd) continue;
      var item = new TranslationItem(
        val.value,
        val.locText,
        val.value,
        this.translation,
        val
      );
      this.itemValues.push(item);
      this.addCustomPropertiesForItemValue(this.obj[i], item);
    }
  }
  private addCustomPropertiesForItemValue(
    itemValue: any,
    textItem: TranslationItem
  ) {
    var locProperties = this.getLocalizedProperties(itemValue);
    for (var i = 0; i < locProperties.length; i++) {
      if (locProperties[i].name == "text") continue;
      var item = this.createTranslationItem(itemValue, locProperties[i]);
      if (!!item) {
        item.customText = textItem.text + " (" + item.localizableName + ")";
        item.name = itemValue.value + "." + item.name;
        this.itemValues.push(item);
      }
    }
  }
}

export class TranslationLocale extends Base {
  constructor(public locale: string) {
    super();
  }
  @property({ defaultValue: true }) visible: boolean;
  @property({ defaultValue: true }) enabled: boolean;
}

export class Translation extends Base implements ITranslationLocales {
  public static csvDelimiter = ",";
  public static newLineDelimiter = "\n";
  public exportToCSVFileUI: any;
  public importFromCSVFileUI: any;
  public importFinishedCallback: () => void;
  public translateItemAfterRenderCallback: (
    item: TranslationItem,
    el: any,
    locale: string
  ) => void;
  public availableTranlationsChangedCallback: () => void;
  public tranlationChangedCallback: (
    locale: string,
    name: string,
    value: string,
    context: any
  ) => void;
  private surveyValue: SurveyModel;
  private onBaseObjCreatingCallback: (obj: Base) => void;

  constructor(
    survey: SurveyModel,
    onBaseObjCreating: (obj: Base) => void = null
  ) {
    super();
    this.onBaseObjCreatingCallback = onBaseObjCreating;
    this.locales.push(new TranslationLocale(""));
    this.filteredPages.push(new ItemValue(null, this.showAllPagesText));
    var self = this;
    this.exportToCSVFileUI = function () {
      self.exportToSCVFile("survey_translation.csv");
    };
    this.importFromCSVFileUI = function (el) {
      if (el.files.length < 1) return;
      self.importFromCSVFile(el.files[0]);
      el.value = "";
    };
    this.fireOnObjCreating(this);
    this.survey = survey;
    this.setupToolbarItems();
  }
  public getType(): string {
    return "translation";
  }
  @propertyArray() locales: Array<TranslationLocale>;
  @propertyArray() availableLanguages: Array<ItemValue>;
  @property() selectedLanguageToAdd: string;
  @property() canMergeLocaleWithDefault: boolean;
  @property() mergeLocaleWithDefaultText: string;
  @property({ defaultValue: false }) readOnly: boolean;
  @property() root: TranslationGroup;
  @property({ defaultValue: false }) showAllStrings: boolean;
  @property() filteredPage: PageModel;
  @propertyArray() filteredPages: Array<ItemValue>;

  @property({ defaultValue: true }) isEmpty: boolean;
  /**
   * The list of toolbar items. You may add/remove/replace them.
   * @see IActionBarItem
   */
  @propertyArray() toolbarItems: Array<IActionBarItem>;

  public fireOnObjCreating(obj: Base) {
    if (!this.onBaseObjCreatingCallback) return;
    this.onBaseObjCreatingCallback(obj);
  }

  private setupToolbarItems() {
    this.toolbarItems.push({
      id: "svd-translation-language-selector",
      title: "",
      tooltip: this.selectLanguageOptionsCaption,
      component: "svd-dropdown",
      action: (val: string) => {
        if (val === undefined) return this.selectedLanguageToAdd;
        this.selectedLanguageToAdd = val;
      },
      items: <any>this.availableLanguages,
    });
    this.toolbarItems.push({
      id: "svd-translation-show-all-strings",
      title: this.showAllStringsText,
      tooltip: this.showAllStringsText,
      component: "svd-boolean",
      action: (val: boolean) => {
        if (val === undefined) return this.showAllStrings;
        this.showAllStrings = val;
      },
    });
    this.toolbarItems.push({
      id: "svd-translation-language-selector",
      title: "",
      tooltip: "",
      component: "svd-dropdown",
      action: (val: PageModel) => {
        if (val === undefined) return this.filteredPage;
        this.filteredPage = val;
      },
      items: this.filteredPages,
    });
  }

  protected onPropertyValueChanged(name: string, oldValue: any, newValue: any) {
    super.onPropertyValueChanged(name, oldValue, newValue);
    if (name === "selectedLanguageToAdd") {
      if (!!newValue) {
        this.addLocale(newValue);
      }
    }
    if (name === "canMergeLocaleWithDefault") {
      this.mergeLocaleWithDefaultText = this.getMergeLocaleWithDefaultText();
    }
    if (name === "showAllStrings" || name === "filteredPage") {
      this.reset();
    }
  }
  private getMergeLocaleWithDefaultText(): string {
    if (!this.canMergeLocaleWithDefault) return "";
    var locText = this.getLocaleName(this.defaultLocale);
    return editorLocalization
      .getString("ed.translationMergeLocaleWithDefault")
      ["format"](locText);
  }

  public get survey(): SurveyModel {
    return this.surveyValue;
  }
  public set survey(val: SurveyModel) {
    this.surveyValue = val;
    this.updateFilteredPages();
    this.reset();
  }
  public reset() {
    var rootObj = !!this.filteredPage ? this.filteredPage : this.survey;
    var rootName = !!this.filteredPage ? rootObj["name"] : "survey";
    this.root = new TranslationGroup(rootName, rootObj, this);
    this.root.setAsRoot();
    this.root.reset();
    this.resetLocales();
    this.isEmpty = !this.root.hasItems;
  }
  public get localesStr(): Array<string> {
    var res = [];
    var locales = this.locales;
    for (var i = 0; i < locales.length; i++) {
      res.push(locales[i].locale);
    }
    return res;
  }
  public get defaultLocale(): string {
    return surveyLocalization.defaultLocale;
  }
  public getLocaleName(loc: string) {
    return editorLocalization.getLocaleName(loc, this.defaultLocale);
  }
  public hasLocale(locale: string): boolean {
    var locales = this.locales;
    for (var i = 0; i < locales.length; i++) {
      if (locales[i].locale == locale) return true;
    }
    return false;
  }
  public addLocale(locale: string) {
    if (!this.hasLocale(locale)) {
      var locs = this.localesStr;
      locs.push(locale);
      this.setLocales(locs);
    }
  }
  public resetLocales() {
    var locales = [""];
    this.root.fillLocales(locales);
    this.setLocales(locales);
  }
  public getSelectedLocales(): Array<string> {
    var res = [];
    var locs = this.locales;
    for (var i = 0; i < locs.length; i++) {
      if (locs[i].visible) res.push(locs[i].locale);
    }
    return res;
  }
  public setSelectedLocales(selectedLocales: Array<string>) {
    selectedLocales = selectedLocales || [];
    for (var i = 0; i < selectedLocales.length; i++) {
      if (!this.hasLocale(selectedLocales[i])) {
        this.addLocale(selectedLocales[i]);
      }
    }
    var res = [];
    var locs = this.locales;
    for (var i = 0; i < locs.length; i++) {
      var enabled = this.isLocaleEnabled(locs[i].locale);
      locs[i].visible = enabled && selectedLocales.indexOf(locs[i].locale) > -1;
      locs[i].enabled = enabled;
    }
    return res;
  }
  public get selectLanguageOptionsCaption() {
    return editorLocalization.getString("ed.translationAddLanguage");
  }
  public get showAllStringsText(): string {
    return editorLocalization.getString("ed.translationShowAllStrings");
  }
  public get showAllPagesText(): string {
    return editorLocalization.getString("ed.translationShowAllPages");
  }
  public get noStringsText(): string {
    return editorLocalization.getString("ed.translationNoStrings");
  }
  public get exportToCSVText(): string {
    return editorLocalization.getString("ed.translationExportToSCVButton");
  }
  public get importFromCSVText(): string {
    return editorLocalization.getString("ed.translationImportFromSCVButton");
  }
  public exportToCSV(): string {
    let res = [];
    let headerRow = [];
    let visibleLocales = this.getVisibleLocales();
    headerRow.push("description ↓ - language →");
    for (let i = 0; i < visibleLocales.length; i++) {
      headerRow.push(!!visibleLocales[i] ? visibleLocales[i] : "default");
    }
    res.push(headerRow);
    let itemsHash = <HashTable<TranslationItem>>{};
    this.fillItemsHash("", this.root, itemsHash);
    for (let key in itemsHash) {
      let row = [key];
      let item = itemsHash[key];
      for (let i = 0; i < visibleLocales.length; i++) {
        let val = item.locString.getLocaleText(visibleLocales[i]);
        row.push(!val && i == 0 ? item.defaultValue : val);
      }
      res.push(row);
    }
    return unparse(res, {
      quoteChar: '"',
      escapeChar: '"',
      delimiter: Translation.csvDelimiter,
      header: true,
      newline: Translation.newLineDelimiter,
      skipEmptyLines: false, //or 'greedy',
      columns: null, //or array of strings
    });
  }

  public importFromNestedArray(rows: string[][]) {
    var self = this;
    let locales = rows.shift().slice(1);
    if (locales[0] === "default") {
      locales[0] = "";
    }
    let translation = new Translation(this.survey);
    translation.showAllStrings = true;
    let itemsHash = <HashTable<TranslationItem>>{};
    this.fillItemsHash("", translation.root, itemsHash);
    rows.forEach((row) => {
      let name = row.shift().trim();
      if (!name) return;
      let item = itemsHash[name];
      if (!item) return;
      self.updateItemWithStrings(item, row, locales);
    });
    this.reset();
    if (this.importFinishedCallback) this.importFinishedCallback();
  }

  public exportToSCVFile(fileName: string) {
    var data = this.exportToCSV();
    var blob = new Blob([data], { type: "text/csv" });
    if (window.navigator.msSaveOrOpenBlob) {
      window.navigator.msSaveBlob(blob, fileName);
    } else {
      var elem = window.document.createElement("a");
      elem.href = window.URL.createObjectURL(blob);
      elem.download = fileName;
      document.body.appendChild(elem);
      elem.click();
      document.body.removeChild(elem);
    }
  }
  public importFromCSVFile(file: File) {
    var self = this;
    parse(file, {
      complete: function (results, file) {
        self.importFromNestedArray(<string[][]>results.data);
      },
    });
  }
  public mergeLocaleWithDefault() {
    if (!this.hasLocale(this.defaultLocale)) return;
    this.root.mergeLocaleWithDefault(this.defaultLocale);
    this.locales.splice(0, this.locales.length);
    this.locales.push(new TranslationLocale(""));
    this.reset();
  }
  public expandAll() {
    if (!this.root) return;
    this.root.expandAll();
  }
  public collapseAll() {
    if (!this.root) return;
    this.root.collapseAll();
  }
  translateItemAfterRender(item: TranslationItem, el: any, locale: string) {
    if (!this.translateItemAfterRenderCallback) return;
    if (Array.isArray(el)) {
      for (var i = 0; i < el.length; i++) {
        if (el[i].tagName == "TEXTAREA") {
          el = el[i];
          break;
        }
      }
    }
    this.translateItemAfterRenderCallback(item, el, locale);
  }
  /**
   * Update a translation item with given values
   */
  private updateItemWithStrings(
    item: TranslationItem,
    values: Array<string>,
    locales: Array<string>
  ) {
    for (let i = 0; i < values.length && i < locales.length; i++) {
      let val = values[i].trim();
      if (!val) continue;
      item.values(locales[i]).text = val;
    }
  }

  private getVisibleLocales(): Array<string> {
    return this.locales
      .filter((locale) => locale.visible)
      .map((locale) => locale.locale);
  }

  private fillItemsHash(
    parentName: string,
    group: TranslationGroup,
    itemsHash: HashTable<TranslationItem>
  ) {
    let name = parentName ? parentName + "." + group.name : group.name;
    group.locItems.forEach((item) => {
      itemsHash[name + "." + item.name] = item;
    });
    group.groups.forEach((group) => this.fillItemsHash(name, group, itemsHash));
  }
  private setLocales(locs: Array<string>) {
    for (var i = 0; i < locs.length; i++) {
      var loc = locs[i];
      if (this.hasLocale(loc)) continue;
      var enabled = this.isLocaleEnabled(loc);
      var trLoc = new TranslationLocale(loc);
      trLoc.enabled = enabled;
      trLoc.visible = enabled;
      this.locales.push(trLoc);
    }
    this.canMergeLocaleWithDefault = this.hasLocale(this.defaultLocale);
    this.updateAvailableTranlations();
  }
  private isLocaleEnabled(locale: string): boolean {
    if (!locale) return true;
    var supported = surveyLocalization.supportedLocales;
    if (!supported || supported.length <= 0) return true;
    return supported.indexOf(locale) > -1;
  }
  private updateAvailableTranlations() {
    this.availableLanguages.splice(0, this.availableLanguages.length);
    var locales = (<any>surveyLocalization).getLocales(true);
    for (var i = 0; i < locales.length; i++) {
      var loc = locales[i];
      if (!loc) continue;
      if (this.hasLocale(loc)) continue;
      if (loc == this.defaultLocale) continue;
      this.availableLanguages.push(
        new ItemValue(loc, editorLocalization.getLocaleName(loc))
      );
    }
    this.selectedLanguageToAdd = null;
    this.availableLanguages.unshift(
      new ItemValue(null, this.selectLanguageOptionsCaption)
    );
    !!this.availableTranlationsChangedCallback &&
      this.availableTranlationsChangedCallback();
  }
  private updateFilteredPages() {
    this.filteredPages.splice(0, this.filteredPages.length);
    this.filteredPages.push(new ItemValue(null, this.showAllPagesText));
    for (var i = 0; i < this.survey.pages.length; i++) {
      var page = this.survey.pages[i];
      this.filteredPages.push(new ItemValue(page, page.name));
    }
  }
  dispose() {
    this.importFinishedCallback = undefined;
    this.availableTranlationsChangedCallback = undefined;
    this.tranlationChangedCallback = undefined;
  }
}