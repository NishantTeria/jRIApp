using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace RIAPP.DataService
{
    public interface IDomainService: IDisposable
    {
        MetadataInfo ServiceGetMetadata();
        GetDataResult ServiceGetData(GetDataInfo getInfo);
        ChangeSet ServiceApplyChangeSet(ChangeSet changeSet);
        RefreshRowInfo ServiceRefreshRow(RefreshRowInfo getInfo);
        InvokeResult ServiceInvokeMethod(InvokeInfo parameters);
    }
}
