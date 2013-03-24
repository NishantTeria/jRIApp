using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Reflection;
using RIAPP.DataService.Resources;


namespace RIAPP.DataService.Utils
{
    public class ValueConverter
    {
        protected virtual object ConvertToBool(string value, bool IsNullableType)
        {
            if (value == null)
                return null;
            if (IsNullableType)
                return new Nullable<bool>(bool.Parse(value));
            else
                return bool.Parse(value);
        }

        protected virtual object ConvertToDate(string value, bool IsNullableType, DateConversion dateConversion)
        {
            if (value == null)
                return null;
            DateTime dt = DataHelper.ParseDateTimeValue(value, dateConversion);
            if (IsNullableType)
                return new Nullable<DateTime>(dt);
            else
                return dt;
        }

        protected virtual object ConvertToGuid(string value, bool IsNullableType)
        {
            if (value == null)
                return null;
            if (IsNullableType)
                return new Nullable<Guid>(new Guid(value));
            else
                return new Guid(value);
        }

        protected virtual object ConvertToNumber(string value, bool IsNullableType, Type propType, Type propMainType)
        {
            if (value == null)
                return null;

            object typedVal = Convert.ChangeType(value, propMainType, System.Globalization.CultureInfo.InvariantCulture);
            if (IsNullableType)
            {
                return DataHelper.CreateGenericInstance(propType, propMainType, new object[] { typedVal });
            }
            else
                return typedVal;
        }

        protected virtual object ConvertToBinary(string value,Type propType)
        {
            if (value == null)
                return null;
            byte[] bytes = Convert.FromBase64String(value);

            if (propType == typeof(byte[]))
                return bytes;
            else
                return Activator.CreateInstance(propType, bytes);
        }

        protected virtual object ConvertTo(string value, bool IsNullableType, Type propType, Type propMainType)
        {
            if (value == null)
                return null;
            object typedVal = Convert.ChangeType(value, propMainType, System.Globalization.CultureInfo.InvariantCulture);

            if (IsNullableType)
            {
                return DataHelper.CreateGenericInstance(propType, propMainType, new object[] { typedVal });
            }
            else
                return typedVal;
        }

        protected virtual string ConvertFromGuid(object value)
        {
            return value.ToString();
        }

        protected virtual string ConvertFromDate(object value, bool IsNullable)
        {
            if (IsNullable)
                return DataHelper.DateToValue(((Nullable<DateTime>)value).Value);
            else
                return DataHelper.DateToValue((DateTime)value);
        }

        protected virtual string ConvertFromBool(object value)
        {
            return value.ToString().ToLowerInvariant();
        }

        protected virtual string ConvertFromBytes(object value)
        {
            return Convert.ToBase64String((byte[])value);
        }

        public virtual object ConvertToTyped(Type propType, DataType dataType, DateConversion dateConversion, string value)
        {
            object result = null;
            bool IsNullableType = DataHelper.IsNullableType(propType);
            Type propMainType = null;
            if (!IsNullableType)
                propMainType = propType;
            else
                propMainType = Nullable.GetUnderlyingType(propType);

            switch (dataType)
            {
                case DataType.Bool:
                    result = this.ConvertToBool(value, IsNullableType);
                    break;
                case DataType.DateTime:
                case DataType.Date:
                case DataType.Time:
                    result = this.ConvertToDate(value, IsNullableType, dateConversion);
                    break;
                case DataType.Guid:
                    result = this.ConvertToGuid(value, IsNullableType);
                    break;
                case DataType.Integer:
                case DataType.Decimal:
                case DataType.Float:
                    result = this.ConvertToNumber(value, IsNullableType, propType, propMainType);
                    break;
                case DataType.Binary:
                    result = this.ConvertToBinary(value, propType);
                    break;
                case DataType.String:
                case DataType.None:
                    result = this.ConvertTo(value, IsNullableType, propType, propMainType);
                    break;
                default:
                    throw new Exception(string.Format(ErrorStrings.ERR_VAL_DATATYPE_INVALID, dataType));
            }

            return result;
        }

        public virtual string ConvertToString(object value, Type propType)
        {
            if (value == null)
                return null;
            bool isNullable = DataHelper.IsNullableType(propType);
            Type realType = null;
            if (!isNullable)
                realType = propType;
            else
                realType = Nullable.GetUnderlyingType(propType);

            if (isNullable)
            {
                string str = value.ToString();
                if (str == String.Empty)
                    return null;
            }

            if (realType == typeof(Guid))
            {
                return this.ConvertFromGuid(value);
            }
            else if (realType == typeof(DateTime))
            {
                return this.ConvertFromDate(value, isNullable);
            }
            else if (realType == typeof(Boolean))
            {
                return this.ConvertFromBool(value);
            }
            else if (value is byte[])
            {
                return this.ConvertFromBytes(value);
            }
            else
            {
                if (realType.IsValueType)
                {
                    return (string)Convert.ChangeType(value, typeof(string), System.Globalization.CultureInfo.InvariantCulture);
                }
                else if (realType.FullName == "System.Data.Linq.Binary")
                {
                    return value.ToString().Trim('"');
                }
                else
                {
                    return value.ToString();
                }
            }
        }
   
        public virtual DataType DataTypeFromType(Type type, out bool isArray)
        {
            bool isNullable = DataHelper.IsNullableType(type);
            isArray = false;
            Type realType = null;
            if (!isNullable)
                realType = type;
            else
                realType = Nullable.GetUnderlyingType(type);
            string fullName = realType.FullName, name = fullName;
            if (fullName.EndsWith("[]"))
            {
                isArray = true;
                name = fullName.Substring(0, fullName.Length - 2);
            }

            switch (name)
            {
                case "System.String":
                    return DataType.String;
                case "System.Int16":
                case "System.Int32":
                case "System.Int64":
                case "System.UInt16":
                case "System.UInt32":
                case "System.UInt64":
                case "System.Byte":
                    return DataType.Integer;
                case "System.Decimal":
                    return DataType.Decimal;
                case "System.Double":
                case "System.Single":
                    return DataType.Float;
                case "System.DateTime":
                    return DataType.DateTime;
                case "System.Boolean":
                    return DataType.Bool;
                default:
                    throw new Exception(string.Format("Unsupported method type {0}", realType.FullName));
            }
        }
    }
}
