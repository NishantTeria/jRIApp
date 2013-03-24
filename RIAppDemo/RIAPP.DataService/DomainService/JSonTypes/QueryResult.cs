using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace RIAPP.DataService
{
    public class QueryResult
    {
        public QueryResult() {
            this.ChunksLeft = -1;
        }
        
        public int? TotalCount
        {
            get;
            set;
        }

        public IEnumerable Result
        {
            get;
            set;
        }

        public int ChunksLeft
        {
            get;
            set;
        }

        public string ChunksID
        {
            get;
            set;
        }

        public object extraInfo
        {
            get;
            set;
        }

        /// <summary>
        /// child navigation properties which should be included in the result
        /// in the form dbSetName.parentToChildrenName or dbSetName.childToParentName
        /// for example:Customer.CustomerAddresses
        /// </summary>
        public string[] includeNavigations
        {
            get;
            set;
        }
    }

    public class QueryResult<T>: QueryResult
        where T:class
    {
        public QueryResult()
            :this(Enumerable.Empty<T>(),null,new string[0])
        {
        }

        public QueryResult(IEnumerable<T> result)
            : this(result, null, new string[0])
        {
        }

        public QueryResult(IEnumerable<T> result, int? totalCount)
            : this(result, totalCount, new string[0])
        {
        }

        public QueryResult(IEnumerable<T> result, int? totalCount, string[] includeNavigations)
        {
            this.Result = result;
            this.TotalCount = totalCount;
            this.includeNavigations = includeNavigations == null ? new string[0] : includeNavigations;
        }

        public IEnumerable<T> getResult()
        {
            return (IEnumerable<T>) this.Result;
        }
    }
}
