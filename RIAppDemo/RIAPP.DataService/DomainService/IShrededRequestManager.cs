using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace RIAPP.DataService
{
    public interface IShrededRequestManager : IDisposable
    {
        QueryResult GetNextChunk(Guid id);
        QueryResult AddQueryResult(QueryResult res, int? chunkSize);
    }
}
