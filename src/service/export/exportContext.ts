import { Node } from "@/model/interface/node";

export class ExportContext {
    dbOption: Node;
    type: ExportType;
    withOutLimit: boolean;
    /**
     * export xlsx with the sql written to a separate sheet
     */
    sheetSql?: boolean;
    /**
     * open the exported content in a new editor tab instead of saving to a file
     */
    openInEditor?: boolean;
    table:string;
    sql: string;
    /**
     * es only
     */
    request?: any;
    exportPath: string;
    /**
     * intenel: fields
     */
    fields: any[];
    /**
     * intenel: result
     */
    rows:any;
    /**
     * intenel: trigger when export done
     */
    done: (value?: any) => void;
}

export enum ExportType {
    excel = "xlsx", sql = "sql", csv = "csv",json = "json", markdown = "md"
}