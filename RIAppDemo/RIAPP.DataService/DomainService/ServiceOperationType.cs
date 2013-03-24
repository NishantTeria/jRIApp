using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace RIAPP.DataService
{
    public enum ServiceOperationType
    {
        None,
        GetData,
        SaveChanges,
        RefreshRowData,
        InvokeMethod
    }
}
