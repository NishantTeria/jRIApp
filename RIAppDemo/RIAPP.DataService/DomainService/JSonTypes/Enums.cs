using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace RIAPP.DataService
{
    public enum ChangeType : int
    {
        None = 0, Added = 1, Updated = 2, Deleted = 3
    }

    public enum DataType : int
    {
        None=0, String = 1, Bool = 2, Integer = 3, Decimal = 4, Float = 5, DateTime = 6, Date = 7, Time = 8, Guid = 9, Binary = 10
    }

    public enum DateConversion : int
    {
        None=0, ServerLocalToClientLocal=1, UtcToClientLocal=2
    }

   
    public enum SortOrder : int
    {
        ASC = 0, DESC =1
    }


    public enum FilterType : int
    {
        Equals = 0, Between = 1, StartsWith = 2, EndsWith = 3, Contains = 4, Gt = 5, Lt = 6, GtEq = 7, LtEq = 8, NotEq = 9
    }

    public enum ValueFlags : int
    {
        None=0, Changed=1, Setted=2, Refreshed=4
    }

    public static class OperationNames
    {
        public const string CREATE = "create";
        public const string UPDATE = "update";
        public const string DELETE = "delete";
        public const string REFRESH = "refresh";
        public const string VALIDATE = "validate";
    }

    public enum DeleteAction : int
    {
        NoAction = 0, Cascade = 1, SetNulls = 2
    }
}
